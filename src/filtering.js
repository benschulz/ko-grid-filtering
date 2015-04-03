'use strict';

var viewStateStorage = 'ko-grid-view-state-storage';

define(['module', 'knockout', 'stringifyable', 'ko-grid', 'text!ko-grid-filtering/filtering.html.template'], function (module, ko, stringifyable, koGrid, filteringTemplate) {
    var extensionId = module.id.indexOf('/') < 0 ? module.id : module.id.substring(0, module.id.indexOf('/'));

    var TRUE = stringifyable.predicates.alwaysTrue;

    koGrid.defineExtension(extensionId, {
        dependencies: [],
        initializer: template => template.after('headers').insert('filters', filteringTemplate),
        Constructor: function FullScreenExtension(bindingValue, config, grid) {
            var filters = {};
            var forColumn = column => {
                var columnId = column.id;

                if (!filters[columnId]) {
                    var text = ko.observable('');

                    if (grid.extensions[viewStateStorage])
                        grid.extensions[viewStateStorage].modeIndependent.bind('filters[' + columnId + ']', text);

                    filters[columnId] = {
                        text: text,
                        predicate: ko.pureComputed(() => parseFilterText(column, text()))
                    };
                }

                return filters[columnId];
            };
            this['__forColumn'] = forColumn;

            var rowPredicate = ko.pureComputed(() => {
                var columnPredicates = grid.columns.displayed()
                    .filter(c => forColumn(c).predicate() !== TRUE)
                    .map(c => forColumn(c).predicate().onResultOf(stringifyable.functions.propertyAccessor(c.property)));

                return stringifyable.predicates.and(columnPredicates);
            });

            var throttle = !config.throttle || config.throttle.enabled !== false;
            var throttleAmout = (config.throttle && config.throttle.by) || 300;

            var throttledRowPredicate = throttle ? rowPredicate.extend({throttle: throttleAmout}) : rowPredicate;

            var applied = ko.observable(true);
            this['__applied'] = ko.pureComputed(() => {
                applied(applied() || grid.data.rows.displayedSynchronized() && !grid.data.view.dirty());
                return applied();
            });

            grid.data.predicates.push(ko.pureComputed(()=> {
                applied(false);
                return throttledRowPredicate();
            }));

            this.dispose = () => {
                throttledRowPredicate.dispose();
            };
        }
    });

    function parseFilterText(column, filterText) {
        if (!filterText.length)
            return TRUE;

        return renderedValuePredicate(column, filterText);
    }

    function renderedValuePredicate(column, filterText) {
        var caseSensitive = filterText.toLowerCase() !== filterText;
        var prependWithAsterisk = function (s) {
            return '*' + s;
        };

        if (filterText.indexOf('*') >= 0)
            return renderedValueRegExpPredicate(column, filterText, caseSensitive);
        else
            return renderedValueRegExpPredicate(column, '*' + filterText.replace(/([A-Z])/g, prependWithAsterisk) + '*', caseSensitive);
    }

    function renderedValueRegExpPredicate(column, filterText, caseSensitive) {
        var patternStringElements = filterText.split('*').map(escapeRegExpPatternString);
        var patternString = '^' + patternStringElements.join('.*') + '$';
        var regExp = new RegExp(patternString, caseSensitive ? '' : 'i');

        var renderValue = column.renderValue;
        var predicate = property => regExp.test(renderValue(property));

        return stringifyable.predicates.from(predicate, () => stringifyable.predicates.regularExpression(regExp).stringifyable);
    }

    function escapeRegExpPatternString(patternString) {
        return patternString.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    return koGrid.declareExtensionAlias('filtering', extensionId);
});

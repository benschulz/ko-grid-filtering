'use strict';

var viewStateStorage = 'ko-grid-view-state-storage';

define(['module', 'knockout', 'ko-grid', 'text!ko-grid-filtering/filtering.html.template'], function (module, ko, koGrid, filteringTemplate) {
    var extensionId = module.id.indexOf('/') < 0 ? module.id : module.id.substring(0, module.id.indexOf('/'));

    var TRUE = () => true;

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
                        predicate: ko.pureComputed(() => parseFilterText(grid, column, text()))
                    };
                }

                return filters[columnId];
            };
            this['__forColumn'] = forColumn;

            var rowPredicate = ko.pureComputed(() => {
                var columnPredicates = [];

                grid.columns.displayed().forEach(function (column) {
                    var columnPredicate = forColumn(column).predicate();
                    if (columnPredicate !== TRUE)
                        columnPredicates.push(row => columnPredicate(row[column.property]));
                });

                return !columnPredicates.length ? TRUE : row => {
                    for (var i = 0; i < columnPredicates.length; ++i)
                        if (!columnPredicates[i](row)) return false;
                    return true;
                };
            });

            var throttle = !config.throttle || config.throttle.enabled !== false;
            var throttleAmout = (config.throttle && config.throttle.by) || 150;

            var throttledRowPredicate = throttle ? rowPredicate.extend({throttle: throttleAmout}) : rowPredicate;

            var applied = ko.observable(true);
            this['__applied'] = applied;

            grid.data.predicates.push(ko.pureComputed(()=> {
                applied(false);
                return throttledRowPredicate();
            }));

            var appliedSubscription = grid.data.rows.displayedSynchronized.subscribe(synchronized => {
                applied(applied() || synchronized);
            });

            this.dispose = () => {
                appliedSubscription.dispose();
                throttledRowPredicate.dispose();
            };
        }
    });

    function parseFilterText(grid, column, filterText) {
        if (!filterText.length)
            return TRUE;

        return renderedValuePredicate(grid, column, filterText);
    }

    function renderedValuePredicate(grid, column, filterText) {
        var caseSensitive = filterText.toLowerCase() !== filterText;
        var prependWithAsterisk = function (s) {
            return '*' + s;
        };

        if (filterText.indexOf('*') >= 0)
            return renderedValueRegExpPredicate(grid, column, filterText, caseSensitive);
        else
            return renderedValueRegExpPredicate(grid, column, '*' + filterText.replace(/([A-Z])/g, prependWithAsterisk) + '*', caseSensitive);
    }

    function renderedValueRegExpPredicate(grid, column, filterText, caseSensitive) {
        var patternStringElements = filterText.split('*').map(escapeRegExpPatternString);
        var patternString = '^' + patternStringElements.join('.*') + '$';
        var regExp = new RegExp(patternString, caseSensitive ? '' : 'i');

        var renderValue = column.renderValue;
        var valueSelector = grid.data.valueSelector;
        return property => regExp.test(renderValue(valueSelector(property)));
    }

    function escapeRegExpPatternString(patternString) {
        return patternString.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    return koGrid.declareExtensionAlias('filtering', extensionId);
});

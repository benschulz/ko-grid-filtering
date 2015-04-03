/*
 * Copyright (c) 2015, Ben Schulz
 * License: BSD 3-clause (http://opensource.org/licenses/BSD-3-Clause)
 */
define(['onefold-dom', 'indexed-list', 'stringifyable', 'onefold-lists', 'onefold-js', 'ko-grid-view-state-storage', 'ko-data-source', 'ko-indexed-repeat', 'ko-grid-view-modes', 'knockout', 'ko-grid'],    function(onefold_dom, indexed_list, stringifyable, onefold_lists, onefold_js, ko_grid_view_state_storage, ko_data_source, ko_indexed_repeat, ko_grid_view_modes, knockout, ko_grid) {
var text, text_ko_grid_filtering_filteringhtmltemplate, ko_grid_filtering_filtering, ko_grid_filtering;
text = {
  load: function (id) {
    throw new Error('Dynamic load not allowed: ' + id);
  }
};
text_ko_grid_filtering_filteringhtmltemplate = '<tr class="ko-grid-tr ko-grid-filter-row" data-bind="css: { applied: extensions.filtering.__applied }">\n    <td class="ko-grid-th ko-grid-filter-cell" data-bind="indexedRepeat: { forEach: columns.displayed, indexedBy: \'id\', as: \'column\'  }">\n        <input class="ko-grid-filter" type="text" data-bind="value: extensions.filtering.__forColumn(column()).text, valueUpdate: [\'keypress\', \'keyup\']"/>\n    </td>\n</tr>';

var viewStateStorage = 'ko-grid-view-state-storage';
ko_grid_filtering_filtering = function (module, ko, stringifyable, koGrid, filteringTemplate) {
  var extensionId = 'ko-grid-filtering'.indexOf('/') < 0 ? 'ko-grid-filtering' : 'ko-grid-filtering'.substring(0, 'ko-grid-filtering'.indexOf('/'));
  var TRUE = stringifyable.predicates.alwaysTrue;
  koGrid.defineExtension(extensionId, {
    dependencies: [],
    initializer: function (template) {
      return template.after('headers').insert('filters', filteringTemplate);
    },
    Constructor: function FullScreenExtension(bindingValue, config, grid) {
      var filters = {};
      var forColumn = function (column) {
        var columnId = column.id;
        if (!filters[columnId]) {
          var text = ko.observable('');
          if (grid.extensions[viewStateStorage])
            grid.extensions[viewStateStorage].modeIndependent.bind('filters[' + columnId + ']', text);
          filters[columnId] = {
            text: text,
            predicate: ko.pureComputed(function () {
              return parseFilterText(column, text());
            })
          };
        }
        return filters[columnId];
      };
      this['__forColumn'] = forColumn;
      var rowPredicate = ko.pureComputed(function () {
        var columnPredicates = grid.columns.displayed().filter(function (c) {
          return forColumn(c).predicate() !== TRUE;
        }).map(function (c) {
          return forColumn(c).predicate().onResultOf(stringifyable.functions.propertyAccessor(c.property));
        });
        return stringifyable.predicates.and(columnPredicates);
      });
      var throttle = !config.throttle || config.throttle.enabled !== false;
      var throttleAmout = config.throttle && config.throttle.by || 300;
      var throttledRowPredicate = throttle ? rowPredicate.extend({ throttle: throttleAmout }) : rowPredicate;
      var applied = ko.observable(true);
      this['__applied'] = ko.pureComputed(function () {
        applied(applied() || grid.data.rows.displayedSynchronized() && !grid.data.view.dirty());
        return applied();
      });
      grid.data.predicates.push(ko.pureComputed(function () {
        applied(false);
        return throttledRowPredicate();
      }));
      this.dispose = function () {
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
    var predicate = function (property) {
      return regExp.test(renderValue(property));
    };
    return stringifyable.predicates.from(predicate, function () {
      return stringifyable.predicates.regularExpression(regExp).stringifyable;
    });
  }
  function escapeRegExpPatternString(patternString) {
    return patternString.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }
  return koGrid.declareExtensionAlias('filtering', extensionId);
}({}, knockout, stringifyable, ko_grid, text_ko_grid_filtering_filteringhtmltemplate);
ko_grid_filtering = function (main) {
  return main;
}(ko_grid_filtering_filtering);return ko_grid_filtering;
});
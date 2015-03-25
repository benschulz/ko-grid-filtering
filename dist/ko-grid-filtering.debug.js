/**
 * @license Copyright (c) 2015, Ben Schulz
 * License: BSD 3-clause (http://opensource.org/licenses/BSD-3-Clause)
 */
;(function(factory) {
    if (typeof define === 'function' && define['amd'])
        define(['knockout', 'ko-grid', 'ko-grid-view-state-storage', 'ko-data-source', 'ko-indexed-repeat', 'ko-grid-view-modes'], factory);
    else
        window['ko-grid-filtering'] = factory(window.ko, window.ko.bindingHandlers['grid']);
} (function(knockout, ko_grid) {
var text, text_ko_grid_filtering_filteringhtmltemplate, ko_grid_filtering_filtering, ko_grid_filtering;
text = {
  load: function (id) {
    throw new Error('Dynamic load not allowed: ' + id);
  }
};
text_ko_grid_filtering_filteringhtmltemplate = '<tr class="ko-grid-tr ko-grid-filter-row" data-bind="css: { applied: extensions.filtering.__applied }">\n    <td class="ko-grid-th ko-grid-filter-cell" data-bind="indexedRepeat: { forEach: columns.displayed, indexedBy: \'id\', as: \'column\'  }">\n        <input class="ko-grid-filter" type="text" data-bind="value: extensions.filtering.__forColumn(column()).text, valueUpdate: [\'keypress\', \'keyup\']"/>\n    </td>\n</tr>';

var viewStateStorage = 'ko-grid-view-state-storage';
ko_grid_filtering_filtering = function (module, ko, koGrid, filteringTemplate) {
  var extensionId = 'ko-grid-filtering'.indexOf('/') < 0 ? 'ko-grid-filtering' : 'ko-grid-filtering'.substring(0, 'ko-grid-filtering'.indexOf('/'));
  var TRUE = function () {
    return true;
  };
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
              return parseFilterText(grid, column, text());
            })
          };
        }
        return filters[columnId];
      };
      this['__forColumn'] = forColumn;
      var rowPredicate = ko.pureComputed(function () {
        var columnPredicates = [];
        grid.columns.displayed().forEach(function (column) {
          var columnPredicate = forColumn(column).predicate();
          if (columnPredicate !== TRUE)
            columnPredicates.push(function (row) {
              return columnPredicate(row[column.property]);
            });
        });
        return !columnPredicates.length ? TRUE : function (row) {
          for (var i = 0; i < columnPredicates.length; ++i)
            if (!columnPredicates[i](row))
              return false;
          return true;
        };
      });
      var throttle = !config.throttle || config.throttle.enabled !== false;
      var throttleAmout = config.throttle && config.throttle.by || 150;
      var throttledRowPredicate = throttle ? rowPredicate.extend({ throttle: throttleAmout }) : rowPredicate;
      var applied = ko.observable(true);
      this['__applied'] = applied;
      grid.data.predicates.push(ko.pureComputed(function () {
        applied(false);
        return throttledRowPredicate();
      }));
      var appliedSubscription = grid.data.rows.displayedSynchronized.subscribe(function (synchronized) {
        applied(applied() || synchronized);
      });
      this.dispose = function () {
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
    return function (property) {
      return regExp.test(renderValue(valueSelector(property)));
    };
  }
  function escapeRegExpPatternString(patternString) {
    return patternString.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }
  return koGrid.declareExtensionAlias('filtering', extensionId);
}({}, knockout, ko_grid, text_ko_grid_filtering_filteringhtmltemplate);
ko_grid_filtering = function (main) {
  return main;
}(ko_grid_filtering_filtering);return ko_grid_filtering;
}));
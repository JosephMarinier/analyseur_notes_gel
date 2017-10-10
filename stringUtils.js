var _ = require('underscore');

/**
 * Pads or truncates the given value to the given width. Value will end up at
 *	center surrounded by the given padding character if needed.
 *
 * @param width {number} Width of the resulting string.
 * @param [value] {string} Value to format.
 * @param [padding] {string} Padding character.
 * @returns {string} The given value, padded or truncated to the given width.
 */
function center(width, value, padding) {
	value = (value ? String(value) : '');
	padding = (padding ? String(padding)[0] : ' ');
	if (value.length > width) {
		return value.slice(0, width);
	}
	while (value.length < width) {
		value = (value.length % 2
			? value + padding
			: padding + value
		);
	}
	return value;
}

/**
 * Pads or truncates the given value to the given width. Value will end up at
 *	left followed by the given padding character if needed.
 *
 * @param width {number} Width of the resulting string.
 * @param [value] {string} Value to format.
 * @param [padding] {string} Padding character.
 * @returns {string} The given value, padded or truncated to the given width.
 */
function left(width, value, padding) {
	value = (value ? String(value) : '');
	padding = (padding ? String(padding)[0] : ' ');
	if (value.length > width) {
		return value.slice(0, width);
	}
	while (value.length < width) {
		value = value + padding;
	}
	return value;
}

/**
 * Pads or truncates the given value to the given width. Value will end up at
 *	right preceded by the given padding character if needed.
 *
 * @param width {number} Width of the resulting string.
 * @param [value] {string} Value to format.
 * @param [padding] {string} Padding character.
 * @returns {string} The given value, padded or truncated to the given width.
 */
function right(width, value, padding) {
	value = (value ? String(value) : '');
	padding = (padding ? String(padding)[0] : ' ');
	if (value.length > width) {
		return value.slice(0, width);
	}
	while (value.length < width) {
		value = padding + value;
	}
	return value;
}

/**
 * Returns a ready to display string representing the given objects array in a
 *	table with nested headers.
 *
 * @param lines {Object[]} The array of objects to display, one per line.
 * @param [options] {Object} Formatting options.
 * @param [options.delimiters] {string[]} The array of column delimiters.
 *	First delimiter is for top level columns and the rest is for nested columns.
 *	Last one being repeated until the deepest level.
 * @param [options.border] {Object} If omitted, left border defaults to right half
 *	of first delimiter and right border to left half of first delimiter.
 * @param [options.border.left] {string} Defaults to empty if border specified.
 * @param [options.border.right] {string} Defaults to empty if border specified.
 * @param [options.showHeaders] {boolean} Trigger display of the headers. Defaults
 *	to true.
 * @returns {string} The given objects array formatted in a table.
 */
function rowify(lines, options) {
	if (!options) {
		options = Object.create(null);
	}

	if (options.delimiters) {
		if (!_.isArray(options.delimiters)) {
			options.delimiters = [options.delimiters];
		}
	} else {
		options.delimiters = [' '];
	}

	if (!_.has(options, 'showHeaders')) {
		options.showHeaders = true;
	}

	var del = _.first(options.delimiters),
		borders = (options.border
			? [options.border.left, options.border.right]
			: [del.slice(del.length / 2), del.slice(0, (del.length + 1) / 2)]),
		headers = Object.create(null),
		headersCopy;

	// Create unique headers
	function checkNested(headers, line) {
		_.each(line, function (col, header) {
			if (_.isObject(col)) {
				if (!_.has(headers, header)) {
					headers[header] = Object.create(null);
				}
				checkNested(headers[header], col);
			} else {
				col = String(col);
				header = String(header);// Keys being indices in case of array
				if (!_.has(headers, header)) {
					headers[header] = (options.showHeaders ? header.length : 0);
				}
				if (col.length > headers[header]) {
					headers[header] = col.length;
				}
			}
		});
	}
	lines.forEach(function (line) {
		checkNested(headers, line);
	});
	if (_.isEmpty(headers)) {
		return '';
	}

	// Augment last nested header's width by the given overflow
	function adjustColWidth(headers, overflow) {
		var lastHeader = _.last(_.keys(headers));
		if (_.isObject(headers[lastHeader])) {
			adjustColWidth(headers[lastHeader], overflow);
		} else {
			headers[lastHeader] += overflow;
		}
	}
	// Adjust headers' width according to their nested headers' width
	function getNestedWidth(headers, delimiters) {
		if (_.isObject(headers)) {
			var delimiterWidth = _.first(delimiters).length;

			return _.map(headers, function (nested, header) {
				var nestedWidth = getNestedWidth(
					nested,
					delimiters.length > 1 ? _.rest(delimiters) : delimiters
				);

				let width = String(header).length;
				if (nestedWidth < width) {
					// Augment last nested header's width by the difference
					adjustColWidth(nested, width - nestedWidth);
				}

				return nestedWidth;
			}).reduce(function (a, b) {
				return a + delimiterWidth + b;
			});
		}
		return headers;
	}

	// Create bottom header line
	function getDeepest(headers, line) {
		line = line || Object.create(null);
		_.each(headers, function (nested, header) {
			if (_.isObject(nested)) {
				line[header] = Object.create(null);
				getDeepest(nested, line[header]);
				return false;
			}
			line[header] = header;
			return true;
		});
		return line;
	}
	// Create rest of header lines
	function reduceDept(headers, line) {
		line = line || Object.create(null);
		_.each(headers, function (nested, header) {
			if (_.isObject(nested)) {
				if (_.some(nested, _.isObject)) {
					line[header] = Object.create(null);
					reduceDept(nested, line[header]);
				} else {
					line[header] = header;
				}
			}
		});
		return line;
	}

	if (options.showHeaders) {
		getNestedWidth(headers, options.delimiters);

		headersCopy = getDeepest(headers);
		while (!_.isEmpty(headersCopy)) {
			lines.unshift(headersCopy);
			headersCopy = reduceDept(headersCopy);
		}
	}

	// Create the result string
	function formatLine(headers, line, delimiters) {
		if (_.isObject(headers)) {
			if (options.showHeaders && _.isString(line)) {
				return center(getNestedWidth(headers, delimiters), line);
			}
			return _.map(headers, function (header, headerName) {
				return formatLine(
					header,
					line && line[headerName],
					delimiters.length > 1 ? _.rest(delimiters) : delimiters
				);
			}).join(_.first(delimiters));
		}
		return center(headers, line);
	}
	return lines.map(function (line) {
		return borders.join(formatLine(headers, line, options.delimiters));
	}).join('\n');
}

/**
 * Returns a setColor object that offers the different functions to color text.
 *	Note that the user does not access this method, but only a setColor object
 *	obtained by calling this method without parameters. An outside function is
 *	passed only when defining the chaining ".and" object and represents the
 *	change to make to the text for the color before ".and".
 *
 * @param [outside] {function} Optional. Function to apply after, with the result.
 */
function setColor(outside) {
	return Object.defineProperties(Object.create(null), _.mapObject({
		foreground: 0,
		background: 10
	}, function (groundValue, ground) {
		return {enumerable: true, get: function () {
			var shades = Object.create(null);
			Object.defineProperties(shades, _.mapObject({
				dark: 0,
				light: 60
			}, function (shadeValue, shade) {
				return {enumerable: true, get: function () {
					var colors = Object.create(null);
					Object.defineProperties(colors, _.mapObject({
						black: 0,
						red: 1,
						green: 2,
						yellow: 3,
						blue: 4,
						magenta: 5,
						cyan: 6,
						white: 7
					}, function (colorValue) {
						return {enumerable: true, get: function () {
							function inside(string) {
								return String.prototype.concat(
									'\u001b[',
									30 + groundValue + shadeValue + colorValue,
									'm',
									string,
									'\u001b[',
									// "color" 9 resets this ground to default
									39 + groundValue,
									'm'
								);
							}
							// If an outside function is passed (defining ".and"
							// object), the chain stops and the color function
							// applies inside and outside functions.
							return (_.isFunction(outside) ? function (string) {
								return outside(inside(string));
							// If no outside function are passed (defining new
							// setObject object), the color function is simply
							// the inside function on which ".and" is offered
							// with only the other ground available.
							} : Object.defineProperty(inside, 'and', {
								enumerable: true,
								get: function () {
									// Omit the Getter of the ground yet defined
									return _.omit(setColor(inside), ground);
								}
							}));
						}};
					}));
					// Offer access to "light.black" by "dark.gray (or grey)"
					// and to "dark.white" by "light.gray (or grey)"
					Object.defineProperties(colors, _.mapObject({
						gray: undefined,
						grey: undefined
					}, function () {
						return {enumerable: true, get: function () {
							var temp = {
								dark: shades.light.black,
								light: shades.dark.white
							};
							return temp[shade];
						}};
					}));
					return colors;
				}};
			}));
			// Offer access to "dark.black" by "black"
			// and to "light.white" by "white"
			Object.defineProperties(shades, _.mapObject({
				black: shades.dark,
				white: shades.light
			}, function (shade, color) {
				return {enumerable: true, get: function () {
					return shade[color];
				}};
			}));
			return shades;
		}};
	}));
}

module.exports = {
	center: center,
	left: left,
	right: right,
	rowify: rowify,
	setColor: setColor()
};

var ctrl = Object.create(null);
_.chain(26).range().each(function (unicode) {
	Object.defineProperty(ctrl, String.fromCharCode(unicode + 'A'.charCodeAt(0)), {
		enumerable: true,
		value: String.fromCharCode(unicode + 1),
		writable: false
	});
});

var arrow = Object.defineProperties(Object.create(null), _.mapObject({
	LEFT: '\u2190',
	UP: '\u2191',
	RIGHT: '\u2192',
	DOWN: '\u2193',
	HORIZONTAL: '\u2194',
	VERTICAL: '\u2195'
}, function (value) {
	return {
		enumerable: true,
		value: value,
		writable: false
	};
}));

var line = Object.defineProperties(Object.create(null), _.mapObject({
	HORIZONTAL: '\u2500',
	VERTICAL: '\u2502',
	DOWN_RIGHT: '\u250C',
	DOWN_LEFT: '\u2510',
	UP_RIGHT: '\u2514',
	UP_LEFT: '\u2518',
	VERTICAL_RIGHT: '\u251C',
	VERTICAL_LEFT: '\u2524',
	DOWN_HORIZONTAL: '\u252C',
	UP_HORIZONTAL: '\u2534',
	VERTICAL_HORIZONTAL: '\u253C'
}, function (value) {
	return {
		enumerable: true,
		value: value,
		writable: false
	};
}));

var rectangle = Object.defineProperties(Object.create(null), _.mapObject({
	UP: '\u2580',
	DOWN: '\u2584',
	FULL: '\u2588',
	LEFT: '\u258C',
	RIGHT: '\u2590',
	FULL_LIGHT: '\u2591',
	FULL_MEDIUM: '\u2592',
	FULL_DARK: '\u2593',
	CENTER: '\u25A0'
}, function (value) {
	return {
		enumerable: true,
		value: value,
		writable: false
	};
}));

var triangle = Object.defineProperties(Object.create(null), _.mapObject({
	UP: '\u25B2',
	RIGHT: '\u25BA',
	DOWN: '\u25BC',
	LEFT: '\u25C4'
}, function (value) {
	return {
		enumerable: true,
		value: value,
		writable: false
	};
}));

var key = Object.defineProperties(Object.create(null), _.mapObject({
	ESCAPE: '\u001B',
	UP: '\u001B[A',
	DOWN: '\u001B[B',
	RIGHT: '\u001B[C',
	LEFT: '\u001B[D',
	CTRL: ctrl
}, function (value) {
	return {
		enumerable: true,
		value: value,
		writable: false
	};
}));

Object.defineProperties(module.exports, _.mapObject({
	// These are extended ASCII characters that can be used to make pretty command prompts.
	EMPTY: '\u0000',
	KEY: key,
	TIMES: '\u00D7',
	DIVIDED_BY: '\u00F7',
	ARROW: arrow,
	LINE: line,
	RECTANGLE: rectangle,
	TRIANGLE: triangle,
	SUN: '\u263C',
	SPADE: '\u2660',
	CLUB: '\u2663',
	HEART: '\u2665',
	DIAMOND: '\u2666'
}, function (value) {
	return {
		enumerable: true,
		value: value,
		writable: false
	};
}));

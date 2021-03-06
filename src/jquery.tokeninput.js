/*
 * jQuery Plugin: Tokenizing Autocomplete Text Entry
 * Version 1.6.2
 *
 * Copyright (c) 2009 James Smith (http://loopj.com)
 * Licensed jointly under the GPL and MIT licenses,
 * choose which one suits your project best!
 *
 */
;(function($) {
	var DEFAULT_SETTINGS = {
		// Search settings
		method: "GET",
		queryParam: "q",
		searchDelay: 300,
		minChars: 1,
		propertyToSearch: "name",
		jsonContainer: null,
		contentType: "json",
		excludeCurrent: false,
		excludeCurrentParameter: "x",

		// Prepopulation settings
		prePopulate: null,
		processPrePopulate: false,

		// localData empty also show list
		localDataEmptyList: false,

		// Display settings
		hintText: "Type in a search term",
		noResultsText: "No results",
		searchingText: "Searching...",
		deleteText: "&#215;",
		animateDropdown: true,
		placeholder: null,
		theme: null,
		zindex: 999,
		resultsLimit: null,

		enableHTML: false,

		resultsFormatter: function(item) {
			var string = item[this.propertyToSearch];
			return "<li>" + (this.enableHTML ? string : _escapeHTML(string)) + "</li>";
		},

		tokenFormatter: function(item) {
			var string = item[this.propertyToSearch];
			return "<li><p>" + (this.enableHTML ? string : _escapeHTML(string)) + "</p></li>";
		},

		dropdownStyle: null,

		// Tokenization settings
		tokenLimit: null,
		tokenDelimiter: ",",
		preventDuplicates: false,
		tokenValue: "id",

		// Behavioral settings
		allowFreeTagging: false,
		allowTabOut: false,
		autoSelectFirstResult: false,

		// Callbacks
		onResult: null,
		onCachedResult: null,
		onAdd: null,
		onFreeTaggingAdd: null,
		onDelete: null,
		onReady: null,

		// Other settings
		idPrefix: "token-input-",

		// Keep track if the input is currently in disabled mode
		disabled: false
	};

	// Default classes to use when theming
	var DEFAULT_CLASSES = {
		tokenList: "token-input-list",
		token: "token-input-token",
		tokenReadOnly: "token-input-token-readonly",
		tokenDelete: "token-input-delete-token",
		selectedToken: "token-input-selected-token",
		highlightedToken: "token-input-highlighted-token",
		dropdown: "token-input-dropdown",
		dropdownItem: "token-input-dropdown-item",
		dropdownItem2: "token-input-dropdown-item2",
		selectedDropdownItem: "token-input-selected-dropdown-item",
		inputToken: "token-input-input-token",
		focused: "token-input-focused",
		disabled: "token-input-disabled"
	};

	// Input box position "enum"
	var POSITION = {
		BEFORE: 0,
		AFTER: 1,
		END: 2
	};

	// Keys "enum"
	var KEY = {
		BACKSPACE: 8,
		TAB: 9,
		ENTER: 13,
		ESCAPE: 27,
		SPACE: 32,
		PAGE_UP: 33,
		PAGE_DOWN: 34,
		END: 35,
		HOME: 36,
		LEFT: 37,
		UP: 38,
		RIGHT: 39,
		DOWN: 40,
		NUMPAD_ENTER: 108,
		COMMA: 188
	};

	var HTML_ESCAPES = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#x27;',
		'/': '&#x2F;'
	};

	var HTML_ESCAPE_CHARS = /[&<>"'\/]/g;

	function coerceToString(val) {
		return String((val === null || val === undefined) ? '' : val);
	}

	function _escapeHTML(text) {
		return coerceToString(text).replace(HTML_ESCAPE_CHARS, function(match) {
			return HTML_ESCAPES[match];
		});
	}

	// Additional public (exposed) methods
	var methods = {
		init: function(url_or_data_or_function, options) {
			var settings = $.extend({}, DEFAULT_SETTINGS, options || {});

			return this.each(function() {
				$(this).data("tokenInputObject", new $.TokenList(this, url_or_data_or_function, settings));

				// Initialization is done
				if (typeof settings.onReady === "function") {
					settings.onReady.call($(this));
				}
			});
		},
		clear: function() {
			this.data("tokenInputObject").clear();
			return this;
		},
		add: function(item) {
			this.data("tokenInputObject").add(item);
			return this;
		},
		remove: function(item) {
			this.data("tokenInputObject").remove(item);
			return this;
		},
		get: function() {
			return this.data("tokenInputObject").getTokens();
		},
		$: function(query) {
			return this.data("tokenInputObject").$(query);
		},
		getBody: function() {
			return this.data("tokenInputObject").getBody();
		},
		toggleDisabled: function(disable) {
			this.data("tokenInputObject").toggleDisabled(disable);
			return this;
		},
		setOptions: function(options) {
			$.extend(this.data("tokenInputObject").settings, options || {});
			return this;
		},
		getOptions: function(name) {
			var settings = this.data("tokenInputObject").settings;
			return name ? settings[name] : settings;
		},
		self: function() {
			return this.data("tokenInputObject");
		},
		destroy: function() {
			if (this.data("tokenInputObject")) {
				this.data("tokenInputObject").clear();
				var tmpInput = this;
				var closest = this.parent();
				closest.empty();
				tmpInput.show();
				closest.append(tmpInput);
				return tmpInput;
			}
		}
	};

	// Expose the .tokenInput function to jQuery as a plugin
	$.fn.tokenInput = function(method) {
		// Method calling and initialization logic
		if (methods[method]) {
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		} else {
			return methods.init.apply(this, arguments);
		}
	};

	// TokenList class for each input
	$.TokenList = function(input, url_or_data, settings) {
		this.settings = settings;
		var TLSelf = this;
		//
		// Initialization
		//

		// Configure the data source
		if (typeof(url_or_data) === "string" || typeof(url_or_data) === "function") {
			// Set the url to query against
			TLSelf.settings.url = url_or_data;

			// If the URL is a function, evaluate it here to do our initalization work
			var url = computeURL();

			// Make a smart guess about cross-domain if it wasn't explicitly specified
			if (TLSelf.settings.crossDomain === undefined && typeof url === "string") {
				if (url.indexOf("://") === -1) {
					TLSelf.settings.crossDomain = false;
				} else {
					TLSelf.settings.crossDomain = (location.href.split(/\/+/g)[1] !== url.split(/\/+/g)[1]);
				}
			}
		} else if (typeof(url_or_data) === "object") {
			// Set the local data to search through
			TLSelf.settings.local_data = url_or_data;
		}

		// Build class names
		if (TLSelf.settings.classes) {
			// Use custom class names
			TLSelf.settings.classes = $.extend({}, DEFAULT_CLASSES, TLSelf.settings.classes);
		} else if (TLSelf.settings.theme) {
			// Use theme-suffixed default class names
			TLSelf.settings.classes = {};
			$.each(DEFAULT_CLASSES, function(key, value) {
				TLSelf.settings.classes[key] = value + "-" + TLSelf.settings.theme;
			});
		} else {
			TLSelf.settings.classes = DEFAULT_CLASSES;
		}

		// Save the tokens
		var saved_tokens = [];

		// Keep track of the number of tokens in the list
		var token_count = 0;

		// Basic cache to save on db hits
		var cache = new $.TokenList.Cache();

		// Keep track of the timeout, old vals
		var timeout;
		var input_val;

		var timeout_blur;

		// Create a new text input an attach keyup events
		var $input_box = $("<input type=\"text\" autocomplete=\"off\" autocapitalize=\"off\"/>")
			.css({
				outline: "none"
			})
			.attr("id", TLSelf.settings.idPrefix + input.id)
			.focus(function(event) {
				if (timeout_blur) {
					clearTimeout(timeout_blur);
					timeout_blur = null;
				}

				if (TLSelf.settings.disabled) {
					return false;
				} else if (!this.value.length && TLSelf.settings.localDataEmptyList && TLSelf.settings.local_data && !event.isTrigger) {
					// show all local data list
					populateEmptyDropdown();
				} else if (TLSelf.settings.tokenLimit === null || TLSelf.settings.tokenLimit !== token_count) {
					show_dropdown_hint();
				}
				$token_list.addClass(TLSelf.settings.classes.focused);
			})
			.blur(function() {
				// wait for next focus
				timeout_blur = setTimeout(hide_dropdown, 100);

				if (TLSelf.settings.allowFreeTagging) {
					add_freetagging_tokens();
				}

				$(this).val("");
				$token_list.removeClass(TLSelf.settings.classes.focused);
			})
			.bind("keyup keydown blur update", resize_input)
			.keydown(function(event) {
				var previous_token;
				var next_token;

				switch (event.keyCode) {
					case KEY.LEFT:
					case KEY.RIGHT:
						if (this.value.length > 0) return;

						previous_token = input_token.prev();
						next_token = input_token.next();

						if ((previous_token.length && previous_token.get(0) === selected_token)
							|| (next_token.length && next_token.get(0) === selected_token)) {
							// Check if there is a previous/next token and it is selected
							if (event.keyCode === KEY.LEFT) {
								deselect_token($(selected_token), POSITION.BEFORE);
							} else {
								deselect_token($(selected_token), POSITION.AFTER);
							}
						} else if (event.keyCode === KEY.LEFT && previous_token.length) {
							// We are moving left, select the previous token if it exists
							select_token($(previous_token.get(0)));
						} else if (event.keyCode === KEY.RIGHT && next_token.length) {
							// We are moving right, select the next token if it exists
							select_token($(next_token.get(0)));
						} else {
							return;
						}

						event.preventDefault();
						break;
					case KEY.UP:
					case KEY.DOWN:
						
						var dropdown_item = null;

						if (event.keyCode === KEY.DOWN) {
							if (selected_dropdown_item) {
								dropdown_item = $(selected_dropdown_item).next();
							}
							if (!dropdown_item || !dropdown_item.length) {
								dropdown_item = $(dropdown).find('li').first();
							}
						} else {
							if (selected_dropdown_item) {
								dropdown_item = $(selected_dropdown_item).prev();
							}
							if (!dropdown_item || !dropdown_item.length) {
								dropdown_item = $(dropdown).find('li').last();
							}
						}

						if (dropdown_item && dropdown_item.length) {
							select_dropdown_item(dropdown_item);
							event.preventDefault();
						}

						break;

					case KEY.BACKSPACE:
						previous_token = input_token.prev();

						if (this.value.length === 0) {
							if (selected_token) {
								delete_token($(selected_token));
								$hiddenInput.change();
							} else if (previous_token.length) {
								select_token($(previous_token.get(0)));
							}

							if (TLSelf.settings.localDataEmptyList && TLSelf.settings.local_data) {
								// show all local data list
								populateEmptyDropdown();
							}

							return false;
						} else if ($(this).val().length === 1) {
							if (TLSelf.settings.localDataEmptyList && TLSelf.settings.local_data) {
								// show all local data list
								populateEmptyDropdown();
							} else {
								hide_dropdown();
							}
						} else {
							// set a timeout just long enough to let this function finish.
							setTimeout(function() {
								do_search();
							}, 5);
						}
						break;

					case KEY.TAB:
					case KEY.ENTER:
					case KEY.NUMPAD_ENTER:
					case KEY.COMMA:
						if (selected_dropdown_item) {
							add_token($(selected_dropdown_item).data("tokeninput"));
							$hiddenInput.change();
						} else {
							if (TLSelf.settings.allowFreeTagging) {
								if (TLSelf.settings.allowTabOut && $(this).val() === "") {
									return true;
								} else {
									add_freetagging_tokens();
								}
							} else {
								$(this).val("");
								if (TLSelf.settings.allowTabOut) {
									return true;
								}
							}
							event.stopPropagation();
							event.preventDefault();
						}
						return false;

					case KEY.ESCAPE:
						hide_dropdown();
						return true;

					default:
						if (String.fromCharCode(event.which)) {
							// set a timeout just long enough to let this function finish.
							setTimeout(function() {
								do_search();
							}, 5);
						}
						break;
				}
			});

		// Keep reference for placeholder
		if (settings.placeholder) {
			$input_box.attr("placeholder", settings.placeholder);
		}

		// Keep a reference to the original input box
		var $hiddenInput = $(input)
			.hide()
			.val("")
			.focus(function() {
				focusInputWithTimeout();
				return $hiddenInput;
			})
			.blur(function() {
				$input_box.blur();

				//return the object to this can be referenced in the callback functions.
				return $hiddenInput;
			});

		// Keep a reference to the selected token and dropdown item
		var selected_token = null;
		var selected_token_index = 0;
		var selected_dropdown_item = null;

		// The list to store the token items in
		var $token_list = $("<ul />")
			.addClass(TLSelf.settings.classes.tokenList)
			.click(function(event) {
				var li = $(event.target).closest("li");
				if (li && li.get(0) && $.data(li.get(0), "tokeninput")) {
					toggle_select_token(li);
				} else {
					// Deselect selected token
					if (selected_token) {
						deselect_token($(selected_token), POSITION.END);
					}

					// Focus input box
					focusInputWithTimeout();
				}
			})
			.mouseover(function(event) {
				var li = $(event.target).closest("li");
				if (li && selected_token !== this) {
					li.addClass(TLSelf.settings.classes.highlightedToken);
				}
			})
			.mouseout(function(event) {
				var li = $(event.target).closest("li");
				if (li && selected_token !== this) {
					li.removeClass(TLSelf.settings.classes.highlightedToken);
				}
			})
			.insertBefore($hiddenInput);

		// The token holding the input box
		var input_token = $("<li />")
			.addClass(TLSelf.settings.classes.inputToken)
			.appendTo($token_list)
			.append($input_box);

		// The list to store the dropdown items in
		var dropdown = $("<div/>")
			.addClass(TLSelf.settings.classes.dropdown)
			.appendTo("body")
			.hide();

		// Magic element to help us resize the text input
		var input_resizer = $("<tester/>")
			.insertAfter($input_box)
			.css({
				position: "absolute",
				top: -9999,
				left: -9999,
				width: "auto",
				fontSize: $input_box.css("fontSize"),
				fontFamily: $input_box.css("fontFamily"),
				fontWeight: $input_box.css("fontWeight"),
				letterSpacing: $input_box.css("letterSpacing"),
				whiteSpace: "nowrap"
			});

		// Pre-populate list if items exist
		$hiddenInput.val("");
		var li_data = TLSelf.settings.prePopulate || $hiddenInput.data("pre");

		if (TLSelf.settings.processPrePopulate && $.isFunction(TLSelf.settings.onResult)) {
			li_data = TLSelf.settings.onResult.call($hiddenInput, li_data);
		}

		if (li_data && li_data.length) {
			$.each(li_data, function(index, value) {
				insert_token(value);
			});
		}

		// Check if widget should initialize as disabled
		if (TLSelf.settings.disabled) {
			toggleDisabled(true);
		}


		//
		// Public functions
		//

		this.clear = function() {
			$token_list.children("li").each(function() {
				if ($(this).children("input").length === 0) {
					delete_token($(this));
				}
			});
		};

		this.add = function(item) {
			add_token(item);
		};

		this.remove = function(item) {
			$token_list.children("li").each(function() {
				if ($(this).children("input").length === 0) {
					var currToken = $(this).data("tokeninput");
					var match = true;
					for (var prop in item) {
						if (item[prop] !== currToken[prop]) {
							match = false;
							break;
						}
					}
					if (match) {
						delete_token($(this));
					}
				}
			});
		};

		this.getTokens = function() {
			return saved_tokens;
		};

		this.toggleDisabled = function(disable) {
			toggleDisabled(disable);
		};

		this.$ = function(query) {
			return $token_list.find(query);
		};

		this.getBody = function() {
			return $token_list;
		};

		// Resize input to maximum width so the placeholder can be seen
		resize_input();

		//
		// Private functions
		//

		function escapeHTML(text) {
			return TLSelf.settings.enableHTML ? text : _escapeHTML(text);
		}

		// Toggles the widget between enabled and disabled state, or according
		// to the [disable] parameter.
		function toggleDisabled(disable) {
			if (typeof disable === 'boolean') {
				TLSelf.settings.disabled = disable
			} else {
				TLSelf.settings.disabled = !TLSelf.settings.disabled;
			}
			$input_box.attr('disabled', TLSelf.settings.disabled);
			$token_list.toggleClass(TLSelf.settings.classes.disabled, TLSelf.settings.disabled);
			// if there is any token selected we deselect it
			if (selected_token) {
				deselect_token($(selected_token), POSITION.END);
			}
			$hiddenInput.attr('disabled', TLSelf.settings.disabled);
		}


		function resize_input() {
			if (input_val === (input_val = $input_box.val())) {
				return;
			}

			// Get width left on the current line
			var width_left = $token_list.width() - $input_box.offset().left - $token_list.offset().left;
			// Enter new content into resizer and resize input accordingly
			var t_val = _escapeHTML(settings.placeholder);
			var w_placeholder = w_val = 30;
			if (t_val) w_placeholder += input_resizer.html(t_val).width();
			t_val = _escapeHTML(input_val);
			if (t_val) w_val += input_resizer.html(t_val).width();

			// Get maximum width, minimum the size of input and maximum the widget's width
			$input_box.width(Math.min($token_list.width(),
				Math.max(width_left, w_placeholder, w_val)));
		}

		function add_freetagging_tokens() {
			var value = $.trim($input_box.val());
			var tokens = value.split(TLSelf.settings.tokenDelimiter);
			$.each(tokens, function(i, token) {
				if (!token) {
					return;
				}

				if ($.isFunction(TLSelf.settings.onFreeTaggingAdd)) {
					token = TLSelf.settings.onFreeTaggingAdd.call($hiddenInput, token);
				}
				var object = {};
				object[TLSelf.settings.tokenValue] = object[TLSelf.settings.propertyToSearch] = token;
				add_token(object);
			});
		}

		// Inner function to a token to the list
		function insert_token(item) {
			var $this_token = $(TLSelf.settings.tokenFormatter(item));
			var readonly = item.readonly === true;

			if (readonly) $this_token.addClass(TLSelf.settings.classes.tokenReadOnly);

			$this_token.addClass(TLSelf.settings.classes.token).insertBefore(input_token);

			// The 'delete token' button
			if (!readonly) {
				$("<span>" + TLSelf.settings.deleteText + "</span>")
					.addClass(TLSelf.settings.classes.tokenDelete)
					.appendTo($this_token)
					.click(function() {
						if (!TLSelf.settings.disabled) {
							delete_token($(this).parent());
							$hiddenInput.change();
							return false;
						}
					});
			}

			// Store data on the token
			var token_data = item;
			$.data($this_token.get(0), "tokeninput", item);

			// Save this token for duplicate checking
			saved_tokens = saved_tokens.slice(0, selected_token_index).concat([token_data]).concat(saved_tokens.slice(selected_token_index));
			selected_token_index++;

			// Update the hidden input
			update_hiddenInput(saved_tokens, $hiddenInput);

			token_count += 1;

			// Check the token limit
			if (TLSelf.settings.tokenLimit !== null && token_count >= TLSelf.settings.tokenLimit) {
				$input_box.hide();
				hide_dropdown();
				return false;
			}
		}

		// Add a token to the token list based on user input
		function add_token(item) {
			var callback = TLSelf.settings.onAdd;

			// See if the token already exists and select it if we don't want duplicates
			if (token_count > 0 && TLSelf.settings.preventDuplicates) {
				var found_existing_token = null;
				$token_list.children().each(function() {
					var existing_token = $(this);
					var existing_data = $.data(existing_token.get(0), "tokeninput");
					if (existing_data && existing_data[settings.tokenValue] === item[settings.tokenValue]) {
						found_existing_token = existing_token;
						return false;
					}
				});

				if (found_existing_token) {
					select_token(found_existing_token);
					input_token.insertAfter(found_existing_token);
					focusInputWithTimeout();
					return;
				}
			}

			// Squeeze $input_box so we force no unnecessary line break
			resize_input();

			// Insert the new tokens
			if (insert_token(item) !== false) {
				// Don't show the help dropdown, they've got the idea
				if (TLSelf.settings.localDataEmptyList && TLSelf.settings.local_data) {
					// show all local data list
					populateEmptyDropdown();
				} else {
					hide_dropdown();
				}
			}

			// Clear input box
			$input_box.val("");

			// Execute the onAdd callback if defined
			if ($.isFunction(callback)) {
				callback.call($hiddenInput, item);
			}
		}

		// Select a token in the token list
		function select_token(token) {
			if (!TLSelf.settings.disabled) {
				token.addClass(TLSelf.settings.classes.selectedToken);
				selected_token = token.get(0);

				// Hide input box
				$input_box.val("");

				// Hide dropdown if it is visible (eg if we clicked to select token)
				if (!TLSelf.settings.localDataEmptyList || !TLSelf.settings.local_data) {
					hide_dropdown();
				}
			}

			// focus for remove
			focusInputWithTimeout();
		}

		// Deselect a token in the token list
		function deselect_token(token, position) {
			token.removeClass(TLSelf.settings.classes.selectedToken);
			selected_token = null;

			if (position === POSITION.BEFORE) {
				input_token.insertBefore(token);
				selected_token_index--;
			} else if (position === POSITION.AFTER) {
				input_token.insertAfter(token);
				selected_token_index++;
			} else {
				input_token.appendTo($token_list);
				selected_token_index = token_count;
			}

			// Show the input box and give it focus again
			focusInputWithTimeout();
		}

		// Toggle selection of a token in the token list
		function toggle_select_token(token) {
			var previous_selected_token = selected_token;

			if (selected_token) {
				deselect_token($(selected_token), POSITION.END);
			}

			if (previous_selected_token === token.get(0)) {
				deselect_token(token, POSITION.END);
			} else {
				select_token(token);
			}
		}

		// Delete a token from the token list
		function delete_token(token) {
			// Remove the id from the saved list
			var token_data = $.data(token.get(0), "tokeninput");
			var callback = TLSelf.settings.onDelete;

			var index = token.prevAll().length;
			if (index > selected_token_index) index--;

			// Delete the token
			token.remove();
			selected_token = null;

			// Show the input box and give it focus again
			focusInputWithTimeout();

			// Remove this token from the saved list
			saved_tokens = saved_tokens.slice(0, index).concat(saved_tokens.slice(index + 1));
			if (saved_tokens.length == 0) {
				$input_box.attr("placeholder", settings.placeholder)
			}
			if (index < selected_token_index) selected_token_index--;

			// Update the hidden input
			update_hiddenInput(saved_tokens, $hiddenInput);

			token_count -= 1;

			if (TLSelf.settings.tokenLimit !== null) {
				$input_box
					.show()
					.val("");
				focusInputWithTimeout();
			}

			// Execute the onDelete callback if defined
			if ($.isFunction(callback)) {
				callback.call($hiddenInput, token_data);
			}
		}

		// Update the hidden input box value
		function update_hiddenInput(saved_tokens, $hiddenInput) {
			var token_values = $.map(saved_tokens, function(el) {
				if (typeof TLSelf.settings.tokenValue == 'function')
					return TLSelf.settings.tokenValue.call(this, el);

				return el[TLSelf.settings.tokenValue];
			});
			$hiddenInput.val(token_values.join(TLSelf.settings.tokenDelimiter));

		}

		// Hide and clear the results dropdown
		function hide_dropdown() {
			dropdown.hide().empty();
			selected_dropdown_item = null;
		}

		function show_dropdown() {
			var style = {};
			if (typeof TLSelf.settings.dropdownStyle == 'function') {
				style = TLSelf.settings.dropdownStyle.call(dropdown, $token_list, $input_box) || {};
			}
			$.each(['position', 'top', 'left', 'width', 'zIndex', 'z-index'], function(index, name) {
				if (style.hasOwnProperty(name)) return;
				switch (name) {
					case 'position':
						style.position = 'absolute';
						break;
					case 'top':
						style.top = $token_list.offset().top + $token_list.outerHeight(true);
						break;
					case 'left':
						style.left = $token_list.offset().left;
						break;
					case 'width':
						style.width = $token_list.width();
						break;
					case 'zIndex':
					case 'z-index':
						style.zIndex = TLSelf.settings.zindex;
						break;
				}
			});

			dropdown.css(style).show();
		}

		function show_dropdown_searching() {
			if (TLSelf.settings.searchingText) {
				dropdown.html("<p>" + escapeHTML(TLSelf.settings.searchingText) + "</p>");
				show_dropdown();
			}
		}

		function show_dropdown_hint() {
			if (TLSelf.settings.hintText) {
				dropdown.html("<p>" + escapeHTML(TLSelf.settings.hintText) + "</p>");
				show_dropdown();
			}
		}

		var regexp_special_chars = new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\-]', 'g');

		function regexp_escape(term) {
			return term.replace(regexp_special_chars, '\\$&');
		}

		// Highlight the query part of the search term
		function highlight_term(value, term) {
			return value.replace(
				new RegExp(
					"(?![^&;]+;)(?!<[^<>]*)(" + regexp_escape(term) + ")(?![^<>]*>)(?![^&;]+;)",
					"gi"
				),
				function(match, p1) {
					return "<b>" + escapeHTML(p1) + "</b>";
				}
			);
		}

		function find_value_and_highlight_term(template, value, term) {
			return template.replace(new RegExp("(?![^&;]+;)(?!<[^<>]*)(" + regexp_escape(value) + ")(?![^<>]*>)(?![^&;]+;)", "g"), highlight_term(value, term));
		}

		// exclude existing tokens from dropdown, so the list is clearer
		function excludeCurrent(results) {
			if (TLSelf.settings.excludeCurrent) {
				var currentTokens = $(input).data("tokenInputObject").getTokens(),
					trimmedList = [];
				if (currentTokens.length) {
					$.each(results, function(index, value) {
						var notFound = true;
						$.each(currentTokens, function(cIndex, cValue) {
							if (value[TLSelf.settings.propertyToSearch] == cValue[TLSelf.settings.propertyToSearch]) {
								notFound = false;
								return false;
							}
						});

						if (notFound) {
							trimmedList.push(value);
						}
					});
					results = trimmedList;
				}
			}

			return results;
		}

		// show all local data list
		function populateEmptyDropdown() {
			var results = TLSelf.settings.local_data;
			if ($.isFunction(TLSelf.settings.onResult)) {
				results = TLSelf.settings.onResult.call($hiddenInput, results);
			}
			populateDropdown('', results);
			return true;
		}

		// Populate the results dropdown with some results
		function populateDropdown(query, results) {
			// exclude current tokens if configured
			results = excludeCurrent(results);

			if (results && results.length) {
				dropdown.empty();
				var dropdown_ul = $("<ul/>")
					.appendTo(dropdown)
					.mouseover(function(event) {
						select_dropdown_item($(event.target).closest("li"));
					})
					.mousedown(function(event) {
						add_token($(event.target).closest("li").data("tokeninput"));
						$hiddenInput.change();
						return false;
					})
					.hide();

				if (TLSelf.settings.resultsLimit && results.length > TLSelf.settings.resultsLimit) {
					results = results.slice(0, TLSelf.settings.resultsLimit);
				}

				$.each(results, function(index, value) {
					var this_li = TLSelf.settings.resultsFormatter(value);

					this_li = find_value_and_highlight_term(this_li, value[TLSelf.settings.propertyToSearch], query);
					this_li = $(this_li).appendTo(dropdown_ul);

					if (index % 2) {
						this_li.addClass(TLSelf.settings.classes.dropdownItem);
					} else {
						this_li.addClass(TLSelf.settings.classes.dropdownItem2);
					}

					if (index === 0 && TLSelf.settings.autoSelectFirstResult) {
						select_dropdown_item(this_li);
					}

					$.data(this_li.get(0), "tokeninput", value);
				});

				show_dropdown();

				if (TLSelf.settings.animateDropdown) {
					dropdown_ul.slideDown("fast");
				} else {
					dropdown_ul.show();
				}
			} else {
				if (TLSelf.settings.noResultsText) {
					dropdown.html("<p>" + escapeHTML(TLSelf.settings.noResultsText) + "</p>");
					show_dropdown();
				}
			}
		}

		// Highlight an item in the results dropdown
		function select_dropdown_item(item) {
			if (item) {
				if (selected_dropdown_item) {
					deselect_dropdown_item($(selected_dropdown_item));
				}

				item.addClass(TLSelf.settings.classes.selectedDropdownItem);
				selected_dropdown_item = item.get(0);
			}
		}

		// Remove highlighting from an item in the results dropdown
		function deselect_dropdown_item(item) {
			item.removeClass(TLSelf.settings.classes.selectedDropdownItem);
			selected_dropdown_item = null;
		}

		// Do a search and show the "searching" dropdown if the input is longer
		// than TLSelf.settings.minChars
		function do_search() {
			var query = $input_box.val();

			if (query && query.length) {
				if (selected_token) {
					deselect_token($(selected_token), POSITION.AFTER);
				}

				if (query.length >= TLSelf.settings.minChars) {
					show_dropdown_searching();
					clearTimeout(timeout);

					timeout = setTimeout(function() {
						run_search(query);
					}, TLSelf.settings.searchDelay);
				} else {
					hide_dropdown();
				}
			}
		}

		// Do the actual search
		function run_search(query) {
			var cache_key = query + computeURL();
			var cached_results = cache.get(cache_key);
			if (cached_results) {
				if ($.isFunction(TLSelf.settings.onCachedResult)) {
					cached_results = TLSelf.settings.onCachedResult.call($hiddenInput, cached_results);
				}
				populateDropdown(query, cached_results);
			} else {
				// Are we doing an ajax search or local data search?
				if (TLSelf.settings.url) {
					var url = computeURL();
					// Extract existing get params
					var ajax_params = {};
					ajax_params.data = {};
					if (url.indexOf("?") > -1) {
						var parts = url.split("?");
						ajax_params.url = parts[0];

						var param_array = parts[1].split("&");
						$.each(param_array, function(index, value) {
							var kv = value.split("=");
							ajax_params.data[kv[0]] = kv[1];
						});
					} else {
						ajax_params.url = url;
					}

					// Prepare the request
					ajax_params.data[TLSelf.settings.queryParam] = query;
					ajax_params.type = TLSelf.settings.method;
					ajax_params.dataType = TLSelf.settings.contentType;
					if (TLSelf.settings.crossDomain) {
						ajax_params.dataType = "jsonp";
					}

					// exclude current tokens?
					// send exclude list to the server, so it can also exclude existing tokens
					if (TLSelf.settings.excludeCurrent) {
						var currentTokens = $(input).data("tokenInputObject").getTokens();
						var tokenList = $.map(currentTokens, function(el) {
							if (typeof TLSelf.settings.tokenValue == 'function')
								return TLSelf.settings.tokenValue.call(this, el);

							return el[TLSelf.settings.tokenValue];
						});

						ajax_params.data[TLSelf.settings.excludeCurrentParameter] = tokenList.join(TLSelf.settings.tokenDelimiter);
					}

					// Attach the success callback
					ajax_params.success = function(results) {
						cache.add(cache_key, TLSelf.settings.jsonContainer ? results[TLSelf.settings.jsonContainer] : results);
						if ($.isFunction(TLSelf.settings.onResult)) {
							results = TLSelf.settings.onResult.call($hiddenInput, results);
						}

						// only populate the dropdown if the results are associated with the active search query
						if ($input_box.val() === query) {
							populateDropdown(query, TLSelf.settings.jsonContainer ? results[TLSelf.settings.jsonContainer] : results);
						}
					};

					// Provide a beforeSend callback
					if (settings.onSend) {
						settings.onSend(ajax_params);
					}

					// Make the request
					$.ajax(ajax_params);
				} else if (TLSelf.settings.local_data) {
					// fix delay time
					if (TLSelf.settings.localDataEmptyList && $input_box.val().length == 0) {
						return;
					}
					// Do the search through local data
					var results = $.grep(TLSelf.settings.local_data, function(row) {
						return row[TLSelf.settings.propertyToSearch].toLowerCase().indexOf(query.toLowerCase()) > -1;
					});

					cache.add(cache_key, results);
					if ($.isFunction(TLSelf.settings.onResult)) {
						results = TLSelf.settings.onResult.call($hiddenInput, results);
					}
					populateDropdown(query, results);
				}
			}
		}

		// compute the dynamic URL
		function computeURL() {
			var url = TLSelf.settings.url;
			if (typeof TLSelf.settings.url == 'function') {
				url = TLSelf.settings.url.call(TLSelf.settings);
			}
			return url;
		}

		// Bring browser focus to the specified object.
		// Use of setTimeout is to get around an IE bug.
		// (See, e.g., http://stackoverflow.com/questions/2600186/focus-doesnt-work-in-ie)
		//
		// obj: a jQuery object to focus()
		function focusInputWithTimeout() {
			if (focusInputWithTimeout.t) return;

			focusInputWithTimeout.t = setTimeout(function() {
				focusInputWithTimeout.t = null;
				$input_box.trigger('focus');
			}, 50);
		}
	};

	// Really basic cache for the results
	$.TokenList.Cache = function(options) {
		var settings, data = {},
			size = 0,
			flush;

		settings = $.extend({
			max_size: 500
		}, options);

		flush = function() {
			data = {};
			size = 0;
		};

		this.add = function(query, results) {
			if (size > settings.max_size) {
				flush();
			}

			if (!data[query]) {
				size += 1;
			}

			data[query] = results;
		};

		this.get = function(query) {
			return data[query];
		};
	};

}(jQuery));
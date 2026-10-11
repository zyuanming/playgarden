// SPDX-License-Identifier: MPL-2.0
// Playgarden modification: Namespace and whitelist saved difficulty options
define(['jquery'], function($) {
	
	var gameOptions = {
		musicVolume: 1,
		effectsVolume: 1,
		casualMode: false
	};
	
	var GameOptions = {
		get: function(optionName, defaultValue) {
			return gameOptions[optionName] == null ? defaultValue : gameOptions[optionName];
		},
		
		set: function(optionName, value) {
			gameOptions[optionName] = value;
			if(typeof Storage != 'undefined' && GridlandStorage) {
				GridlandStorage.gameOptions = JSON.stringify(gameOptions);
			}
			return value;
		},
		
		load: function() {
			try {
				var savedOptions = JSON.parse(GridlandStorage.gameOptions);
				if(savedOptions) {
					if(typeof savedOptions.casualMode === 'boolean') gameOptions.casualMode = savedOptions.casualMode;
				}
			} catch(e) {
				// Nothing
			}
		}
	};
	
	return GameOptions;
});
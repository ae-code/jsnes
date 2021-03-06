/*
JSNES, based on Jamie Sanders' vNES
Copyright (C) 2010 Ben Firshman

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

JSNES.DummyUI = function(nes) {
    this.nes = nes;
    this.enable = function() {};
    this.updateStatus = function() {};
    this.writeAudio = function() {};
    this.writeFrame = function() {};
};

if (typeof jQuery !== 'undefined') {
    (function($) {
      function supportsLocalStorage() {
	// taken from Modernizr
        try {
	  localStorage.setItem("test_key", "test");
	  localStorage.removeItem("test_key");
	  return true;
        } catch(e) {
	  return false;
        }
      }

        $.fn.JSNESUI = function(roms) {
            var parent = this;
            var UI = function(nes) {
                var self = this;
                self.nes = nes;
                
                /*
                 * Create UI
                 */
                self.root = $('<div></div>');
		self.screenContainer = $('<div class="ui-widget-container"></div>').appendTo(self.root);
                self.screen = $('<canvas id="screen_canvas" class="nes-screen" width="256" height="240"></canvas>').appendTo(self.screenContainer);
		self.screenContainer.css("border", "1px solid grey");
		self.screenContainer.css("padding", "12px");
		self.screenContainer.css("height", "240px");
		self.screenContainer.css("width", "256px");
		self.screenContainer.resizable({ 
		  aspectRatio: 256/240,
		  alsoResize: "#screen_canvas"
		});

                if (!self.screen[0].getContext) {
                    parent.html("Your browser doesn't support the <code>&lt;canvas&gt;</code> tag. Try Google Chrome, Safari, Opera or Firefox!");
                    return;
                }
                
                self.romContainer = $('<div class="nes-roms"></div>').appendTo(self.root);
                self.romSelect = $('<select></select>').appendTo(self.romContainer);
                
                self.controls = $('<div class="nes-controls"></div>').appendTo(self.root);
                self.buttons = {
                    pause: $('<input type="button" value="pause" class="btn nes-pause" disabled="disabled">').appendTo(self.controls),
                    restart: $('<input type="button" value="restart" class="btn nes-restart" disabled="disabled">').appendTo(self.controls),
                    sound: $('<input type="button" value="enable sound" class="btn nes-enablesound">').appendTo(self.controls),
                    save: $('<input type="button" value="save" disabled="disabled" class="btn nes-save">').appendTo(self.controls),
                    load: $('<input type="button" value="load" disabled="disabled" class="btn nes-load">').appendTo(self.controls),
		    help: $('<input type="button" value="help" class="btn">').appendTo(self.controls)
                };
                self.status = $('<p class="nes-status">Booting up...</p>').appendTo(self.root);
                self.root.appendTo(parent);
                
		// hide load/save if localStorage is not supported
		self.supportsLocalStorage = supportsLocalStorage();
		if (!self.supportsLocalStorage) {
		  self.buttons.save.hide();
		  self.buttons.load.hide();
		}

		self.buttons.help.click(function() {
		   $("#help").modal('show');
		});

                /*
                 * ROM loading
                 */
                self.romSelect.change(function() {
                    self.loadROM();
                });
                
                /*
                 * Buttons
                 */
                self.buttons.pause.click(function() {
                    if (self.nes.isRunning) {
                        self.nes.stop();
                        self.updateStatus("Paused");
                        self.buttons.pause.attr("value", "resume");
                    }
                    else {
                        self.nes.start();
                        self.buttons.pause.attr("value", "pause");
                    }
                });
                
                self.buttons.save.click(function() {
                    if (self.nes.isRunning) {
                        self.buttons.pause.click();
                        var state = self.nes.toJSON();
                        localStorage[self.romName] = JSON.stringify(state);
                        self.buttons.pause.click();
			self.buttons.load.removeAttr("disabled");
                    }
                });
                
                self.buttons.load.click(function() {
                    if (!localStorage[self.romName]) {
                        self.updateStatus("No Previously Saved State");
                        return;
                    }
                    if (self.nes.isRunning)
                        self.nes.stop();
                    
                    var state = localStorage[self.romName];
                    self.nes.fromJSON(JSON.parse(state));
                    self.nes.start();
                });
        
                self.buttons.restart.click(function() {
                    self.nes.reloadRom();
                    self.nes.start();
                });
        
                self.buttons.sound.click(function() {
                    if (self.nes.opts.emulateSound) {
                        self.nes.opts.emulateSound = false;
                        self.buttons.sound.attr("value", "enable sound");
                    }
                    else {
                        self.nes.opts.emulateSound = true;
                        self.buttons.sound.attr("value", "disable sound");
                    }
                });
        
                /*
                 * Lightgun experiments with mouse
                 * (Requires jquery.dimensions.js)
                 */
                if ($.offset) {
                    self.screen.mousedown(function(e) {
                        if (self.nes.mmap) {
                            self.nes.mmap.mousePressed = true;
                            // FIXME: does not take into account zoom
                            self.nes.mmap.mouseX = e.pageX - self.screen.offset().left;
                            self.nes.mmap.mouseY = e.pageY - self.screen.offset().top;
                        }
                    }).mouseup(function() {
                        setTimeout(function() {
                            if (self.nes.mmap) {
                                self.nes.mmap.mousePressed = false;
                                self.nes.mmap.mouseX = 0;
                                self.nes.mmap.mouseY = 0;
                            }
                        }, 500);
                    });
                }
            
                if (typeof roms != 'undefined') {
                    self.setRoms(roms);
                }
            
                /*
                 * Canvas
                 */
                self.canvasContext = self.screen[0].getContext('2d');
                
                if (!self.canvasContext.getImageData) {
                    parent.html("Your browser doesn't support writing pixels directly to the <code>&lt;canvas&gt;</code> tag. Try the latest versions of Google Chrome, Safari, Opera or Firefox!");
                    return;
                }
                
                self.canvasImageData = self.canvasContext.getImageData(0, 0, 256, 240);
            
                self.resetCanvas();
                /*
                 * Keyboard
                 */
                $(document).
                    bind('keydown', function(evt) {
                        self.nes.keyboard.keyDown(evt); 
                    }).
                    bind('keyup', function(evt) {
                        self.nes.keyboard.keyUp(evt); 
                    }).
                    bind('keypress', function(evt) {
                        self.nes.keyboard.keyPress(evt);
                    });
            
                /*
                 * Sound
                 */
                self.dynamicaudio = new DynamicAudio({
                    swf: nes.opts.swfPath+'dynamicaudio.swf'
                });
            };
        
            UI.prototype = {    
                loadROM: function() {
                    var self = this;
                    self.updateStatus("Downloading...");
                    self.romName = self.romSelect.val();
                    $.ajax({
                        url: escape(self.romName),
                        xhr: function() {
                            var xhr = $.ajaxSettings.xhr();
                            if (typeof xhr.overrideMimeType !== 'undefined') {
                                // Download as binary
                                xhr.overrideMimeType('text/plain; charset=x-user-defined');
                            }
                            self.xhr = xhr;
                            return xhr;
                        },
                        complete: function(xhr, status) {
                            var i, data;
                            if (JSNES.Utils.isIE()) {
                                var charCodes = JSNESBinaryToArray(
                                    xhr.responseBody
                                ).toArray();
                                data = String.fromCharCode.apply(
                                    undefined, 
                                    charCodes
                                );
                            }
                            else {
                                data = xhr.responseText;
                            }
                            self.nes.loadRom(data);
                            self.nes.start();
                            self.enable();
                        }
                    });
                },
                
                resetCanvas: function() {
                    this.canvasContext.fillStyle = 'black';
                    // set alpha to opaque
                    this.canvasContext.fillRect(0, 0, 256, 240);

                    // Set alpha
                    for (var i = 3; i < this.canvasImageData.data.length-3; i += 4) {
                        this.canvasImageData.data[i] = 0xFF;
                    }
                },
                
                /*
                 * Enable and reset UI elements
                 */
                enable: function() {
                    this.buttons.pause.attr("disabled", null);
                    if (this.nes.isRunning) {
                        this.buttons.pause.attr("value", "pause");
                    }
                    else {
                        this.buttons.pause.attr("value", "resume");
                    }
                    this.buttons.restart.attr("disabled", null);
                    if (this.nes.opts.emulateSound) {
                        this.buttons.sound.attr("value", "disable sound");
                    }
                    else {
                        this.buttons.sound.attr("value", "enable sound");
                    }
		    
		    if (this.supportsLocalStorage) {
		      this.buttons.save.removeAttr("disabled");
		      if (localStorage[this.romName])
			this.buttons.load.removeAttr("disabled");
		      else
			this.buttons.load.attr("disabled","disabled");
		    }

                },
            
                updateStatus: function(s) {
                    this.status.text(s);
                },
        
                setRoms: function(roms) {
                    this.romSelect.children().remove();
                    $("<option>Select a ROM...</option>").appendTo(this.romSelect);
                    for (var groupName in roms) {
                        if (roms.hasOwnProperty(groupName)) {
                            var optgroup = $('<optgroup></optgroup>').
                                attr("label", groupName);
                            for (var i = 0; i < roms[groupName].length; i++) {
                                $('<option>'+roms[groupName][i][0]+'</option>')
                                    .attr("value", roms[groupName][i][1])
                                    .appendTo(optgroup);
                            }
                            this.romSelect.append(optgroup);
                        }
                    }
                },
            
                writeAudio: function(samples) {
                    return this.dynamicaudio.writeInt(samples);
                },
            
                writeFrame: function(buffer, prevBuffer) {
                    var imageData = this.canvasImageData.data;
                    var pixel, i, j;

                    for (i=0; i<256*240; i++) {
                        pixel = buffer[i];

                        if (pixel != prevBuffer[i]) {
                            j = i*4;
                            imageData[j] = pixel & 0xFF;
                            imageData[j+1] = (pixel >> 8) & 0xFF;
                            imageData[j+2] = (pixel >> 16) & 0xFF;
                            prevBuffer[i] = pixel;
                        }
                    }

                    this.canvasContext.putImageData(this.canvasImageData, 0, 0);
                }

            };
        
            return UI;
        };
    })(jQuery);
}

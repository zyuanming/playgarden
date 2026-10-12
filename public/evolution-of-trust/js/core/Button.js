Loader.addToManifest(Loader.manifest,{

	// SFX
	button1: "assets/sounds/button1.wav",
	button2: "assets/sounds/button2.wav",
	button3: "assets/sounds/button3.wav"

});

function Button(config){

	var self = this;
	self.id = config.id;
	self.config = config;

	// Create DOM
	var button = document.createElement("div");
	button.className = "object";
	button.classList.add("button");
	if(config.size) button.setAttribute("size", config.size);
	self.dom = button;
	button.dataset.trustId = config.id || config.text_id || "";

	// TOOLTIP?
	if(config.tooltip){
		self.dom.style.width = 190;
		self.dom.style.height = 55;
		self.dom.style.position = "absolute";
		self.dom.setAttribute("data-balloon-length", "large");
		self.dom.setAttribute("data-balloon", Words.get(config.tooltip));
		self.dom.setAttribute("data-balloon-pos", "left");
	}

	// BG
	var bg = document.createElement("div");
	bg.id = "background";
	var text = document.createElement("div");
	text.id = "text";
	var hitbox = document.createElement("div");
	hitbox.id = "hitbox";
	hitbox.setAttribute("role","button"); hitbox.tabIndex=0;
	hitbox.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();hitbox.click();}};
	button.appendChild(bg);
	button.appendChild(text);
	button.appendChild(hitbox);

	// Customize DOM
	button.style.left = config.x+"px";
	button.style.top = config.y+"px";
	self.setText = function(text_id){
		var words = Words.get(text_id);
		if(config.uppercase) words = words.toUpperCase();
		self.setText2(words);
	};
	self.setText2 = function(words){
		text.innerHTML = words;
		hitbox.setAttribute("aria-label", text.textContent.trim());
	};
	self.setText(config.text_id);

	// On hover...
	hitbox.onmouseover = function(){
		if(self.active) button.setAttribute("hover","yes");
	};
	hitbox.onmouseout = function(){
		if(self.active) button.removeAttribute("hover");
	};

	// On click...
	hitbox.onclick = function(){
		if (TrustLifecycle.isPaused() || Scratcher.isTransitioning) return;

		if(parseFloat(getComputedStyle(self.dom).opacity)<0.5) return; // DON'T CLICK INVISIBLE BUTTONS

		if(self.active){

			// Sound!
			if(config.sound){
				Loader.sounds[config.sound].play();
			}else{
				var num = Math.ceil(Math.random()*3);
				Loader.sounds["button"+num].play();
			}

			// Actual Logic
			if(config.onclick) config.onclick();
			if(config.message) publish(config.message);

		}

	};

	// Activate/Deactivate
	self.active = true;
	self.activate = function(){
		self.active = true;
		hitbox.setAttribute("aria-disabled","false");
		button.removeAttribute("deactivated");
	};
	self.deactivate = function(){
		self.active = false;
		hitbox.setAttribute("aria-disabled","true");
		button.setAttribute("deactivated","yes");
		button.removeAttribute("hover");
	};
	if(config.active===undefined) config.active=true;
	if(!config.active) self.deactivate();

	// Listeners!
	if(self.id){
		listen(self, self.id+"/activate", self.activate);
		listen(self, self.id+"/deactivate", self.deactivate);
	}

	// Add & Remove
	self.add = function(){ _add(self); };
	self.remove = function(){
		unlisten(self);
		_remove(self);
	};

}
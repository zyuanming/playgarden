/*****************************

{
	x:x, y:y, max:5, min:-5,
	value: PD.PAYOFFS_DEFAULT[letter],
	onchange: function(value){
		publish("pd/editPayoffs/"+letter,[value]);
	}
}

*****************************/
function IncDecNumber(config){

	var self = this;
	self.id = config.id;

	// Properties
	self.value = config.value;

	// Create DOM
	var dom = document.createElement("div");
	dom.className = "incdec";
	dom.style.left = config.x+"px";
	dom.style.top = config.y+"px";
	self.dom = dom;

	// Number
	var num = document.createElement("div");
	num.className = "incdec_num";
	dom.appendChild(num);
	self.setValue = function(value){

		// Bounds
		if(value>config.max) value=config.max;
		if(value<config.min) value=config.min;

		// Value & UI
		self.value = value;
		num.innerHTML = (self.value>0) ? "+"+self.value : self.value;

	};
	self.setValue(config.value);

	// Two buttons
	var up = document.createElement("div");
	up.className = "incdec_control";
	up.setAttribute("role","button");up.setAttribute("aria-label","增加收益");up.tabIndex=0;up.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();up.click();}};
	up.setAttribute("arrow","up");
	up.onclick = function(){
		if (TrustLifecycle.isPaused() || Scratcher.isTransitioning) return;
		self.setValue(self.value+1);
		self.onchange(self.value);
		Loader.sounds.button2.play(); // higher pitch
	};
	dom.appendChild(up);

	var down = document.createElement("div");
	down.className = "incdec_control";
	down.setAttribute("role","button");down.setAttribute("aria-label","减少收益");down.tabIndex=0;down.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();down.click();}};
	down.setAttribute("arrow","down");
	down.onclick = function(){
		if (TrustLifecycle.isPaused() || Scratcher.isTransitioning) return;
		self.setValue(self.value-1);
		self.onchange(self.value);
		Loader.sounds.button1.play(); // lower pitch
	};
	dom.appendChild(down);

	// On Change...
	self.onchange = function(value){
		config.onchange(value);
	};

	///////////////////////////////////////
	///////////////////////////////////////

	// Add...
	self.add = function(){
		_add(self);
	};

	// Remove...
	self.remove = function(){
		_remove(self);
	};

}
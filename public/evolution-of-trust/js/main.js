var slideshow, slideSelect;
window.onload = function(){

	// PRELOADER
	Q.all([
		Loader.loadAssets(Loader.manifestPreload),
		Words.convert("words.html")
	]).then(function(){

		// CHANGE DOM
		document.body.removeChild($("#preloader"));
		$("#main").style.display = "block";
		$("#footer").style.display = "block";

		// Slideshow
		slideshow = new Slideshow({
			dom: $("#slideshow"),
			slides: SLIDES
		});

		// Slide Select
		slideSelect = new SlideSelect({
			dom: $("#select"),
			slides: SLIDES
		});
		slideSelect.dom.style.display = "none";
		subscribe("start/game", function(){
			slideSelect.dom.style.display = "flex";
			$("#translations").style.display = "none";

			// [FOR DEBUGGING]
			publish("slideshow/next");
			//publish("slideshow/scratch", ["credits"]);

		});

		// SOUND
		var _soundIsOn = !Howler._muted;
		$("#sound").setAttribute("sound",_soundIsOn?"on":"off");
		$("#sound").onclick = function(){
			_soundIsOn = Howler._muted;
			if(Howler.ctx&&Howler.ctx.state==="suspended")Howler.ctx.resume().catch(function(){});
			Howler.mute(!_soundIsOn);
			$("#sound").setAttribute("sound", _soundIsOn?"on":"off");
		};

		$("#sound").onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();$("#sound").click();}};

		// LOAD REAL THINGS
		Loader.loadAssets(
			Loader.manifest,
			function(){
				publish("preloader/done");
			},
			function(ratio){
				publish("preloader/progress", [ratio]);
			}
		).catch(function(){TrustFail("图像或声音加载失败，请点击顶部“重来”。");});

		// First slide!
		slideshow.nextSlide();

	}).catch(function(){TrustFail("文字或预载资源加载失败，请点击顶部“重来”。");});

};
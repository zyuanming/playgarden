// Original CC-BY-4.0; bounded Playgarden changes 2026-10-10. See NOTICE.txt.
MouseGame.Boot = function () {

};

MouseGame.Boot.prototype = {

    preload: function () {
        "use strict";

        this.load.image('preloaderBar', 'assets/preloader.png');
        this.load.image('preloaderBarBg', 'assets/preloader-bg.png');
        game.load.image('preloader-background','assets/backgrounds/preloader.jpg');
    },

    create: function () {
        "use strict";

        //  Unless you specifically know your game needs to support multi-touch I would recommend setting this to 1
        this.game.input.maxPointers = 1;



        // //  Phaser will automatically pause if the browser tab the game is in loses focus. You can disable that here:
        // this.game.stage.disableVisibilityChange = true;

        // if (this.game.device.desktop)
        // {
        //     //  If you have any desktop specific settings, they can go in here
        // }
        // else
        // {
        //     //  Same goes for mobile settings.
        //     //  In this case we're saying "scale the game, no lower than 480x260 and no higher than 1024x768"
        // }
        //

        //  By this point the preloader assets have loaded to the cache, we've set the game settings
        //  So now let's start the real preloader going
        this.game.state.start('preloader');

    }

};

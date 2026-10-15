import type ITextures from '../Assets/ITextures';

var texturesPromise = new Promise<ITextures>((resolve, reject) => {
  const loader = new PIXI.loaders.Loader();

  loader.add('ball', (window as any).DESCENSUS_IMAGES['ball.png']);
  loader.add('ballReflections', (window as any).DESCENSUS_IMAGES['ball-reflections.png']);
  loader.add('girder', (window as any).DESCENSUS_IMAGES['girder.png']);
  loader.add('brick', (window as any).DESCENSUS_IMAGES['brick.png']);
  loader.add('seesaw', (window as any).DESCENSUS_IMAGES['seesaw.png']);
  loader.add('spinner', (window as any).DESCENSUS_IMAGES['spinner.png']);
  loader.add('saw', (window as any).DESCENSUS_IMAGES['saw.png']);
  loader.add('sawSmall', (window as any).DESCENSUS_IMAGES['saw-small.png']);
  loader.add('twoByFour', (window as any).DESCENSUS_IMAGES['two-by-four.png']);
  loader.add('clouds', (window as any).DESCENSUS_IMAGES['clouds.jpg']);
  loader.add('bar', (window as any).DESCENSUS_IMAGES['bar.png']);
  loader.add('helpHand', (window as any).DESCENSUS_IMAGES['help-hand.png']);
  loader.add('plus1Life', (window as any).DESCENSUS_IMAGES['plus-1-life.png']);
  loader.add('windLeft', (window as any).DESCENSUS_IMAGES['wind-left.png']);
  loader.add('windRight', (window as any).DESCENSUS_IMAGES['wind-right.png']);
  loader.add('timeBar', (window as any).DESCENSUS_IMAGES['time-bar.png']);
  loader.add('timeBarTime', (window as any).DESCENSUS_IMAGES['time-bar-time.png']);
  loader.add('ground', (window as any).DESCENSUS_IMAGES['ground.png']);
  loader.add('paper', (window as any).DESCENSUS_IMAGES['paper.jpg']);

  loader.onError.add((error: Error) => reject(error));
  loader.load((loader: PIXI.loaders.Loader, resources: any) => {
    const textures: any = {};
    for (var resourceKey in resources) {
      textures[resourceKey] = resources[resourceKey].texture;
    }

    if (Object.values(textures).some(texture => !texture)) { reject(new Error('Required texture missing')); return; }
    resolve(textures);
  });
});

export default texturesPromise;
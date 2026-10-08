// Guard the single final game journey against an accidental whole-library run.
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2);
if(args.length!==1 || !/^e2e\/[a-z0-9-]+\.spec\.ts$/.test(args[0]) || !existsSync(args[0])){
 console.error('Specify one finished game: npm run test:e2e -- e2e/<game>.spec.ts');process.exit(2);
}
const r=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test',args[0]],{stdio:'inherit'});
if(r.error){console.error(r.error.message);process.exit(1);}process.exit(r.status??1);

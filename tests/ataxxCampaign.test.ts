import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ataxxLevels} from '../src/games/ataxxLevels';
import {start,replay,stage} from '../src/games/ataxxLogic';
it('matches the30 real authored lesson boards without shipping solution certificates',()=>{
 const levels=JSON.parse(readFileSync('docs/ataxx/campaign.json','utf8')).levels;
 expect(ataxxLevels).toHaveLength(30);
 for(const [i,l] of levels.entries()){const {proof,...publicLevel}=l;expect(ataxxLevels[i]).toEqual(publicLevel);const p=replay(start(publicLevel),proof.line,publicLevel);expect(p).not.toBeNull();expect(stage(publicLevel,proof.line,p!)).toBe('success');}
 expect(readFileSync('src/games/AtaxxGarden.tsx','utf8')).not.toContain('campaign.json');
});
it('preserves the pinned MIT source and copyright verbatim',()=>{
 const manifest=JSON.parse(readFileSync('vendor/libataxx/source.json','utf8'));
 expect(manifest.commit).toBe('4226c26dd11a1f74be708882ece6fd9dc96c767b');
 for(const f of manifest.files){const b=readFileSync('vendor/libataxx/'+f.path);expect(createHash('sha256').update(b).digest('hex')).toBe(f.sha256);expect(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex')).toBe(f.gitBlob);}
 const license=readFileSync('vendor/libataxx/LICENSE','utf8');expect(readFileSync('public/ataxx-LICENSE.txt','utf8')).toBe(license);expect(readFileSync('public/THIRD_PARTY_NOTICES.txt','utf8')).toContain(license.trim());
});

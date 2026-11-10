// Where the Nexora product video lives. Put the files in public/media/ (default), or host them elsewhere
// (e.g. Cloudflare R2 / S3) and set NEXORA_VIDEO_URL (+ optional NEXORA_VIDEO_POSTER_URL).
import fs from 'node:fs';
import path from 'node:path';
import type {SiteVideo} from './VideoFeature';
const TITLE='Nexora HR Management System — product tour';
export function siteVideo():SiteVideo|null{
 const url=process.env.NEXORA_VIDEO_URL;
 if(url)return {mp4:url,poster:process.env.NEXORA_VIDEO_POSTER_URL||'/media/nexora-intro-poster.jpg',title:TITLE};
 const pub=(f:string)=>{try{return fs.existsSync(path.join(process.cwd(),'public','media',f))}catch{return false}};
 if(!pub('nexora-intro.mp4'))return null; // section is hidden until the video is added
 return {mp4:'/media/nexora-intro.mp4',webm:pub('nexora-intro.webm')?'/media/nexora-intro.webm':null,poster:pub('nexora-intro-poster.jpg')?'/media/nexora-intro-poster.jpg':'/art/about.svg',captions:pub('nexora-intro.vtt')?'/media/nexora-intro.vtt':null,title:TITLE};
}

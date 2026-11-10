'use client';
// Click-to-play product video. Nothing is downloaded until the visitor presses play (preload none),
// so the video never slows the page down.
import {useRef,useState} from 'react';
import {Play} from 'lucide-react';
export type SiteVideo={mp4:string;webm?:string|null;poster:string;captions?:string|null;title:string};
export default function VideoFeature({video,label}:{video:SiteVideo;label?:string}){
 const [playing,setPlaying]=useState(false);const ref=useRef<HTMLVideoElement>(null);
 return <figure className="vframe">
  {playing
   ?<video ref={ref} controls autoPlay playsInline preload="none" poster={video.poster} aria-label={video.title} onEnded={()=>ref.current?.load()}>
     {video.webm&&<source src={video.webm} type="video/webm"/>}<source src={video.mp4} type="video/mp4"/>
     {video.captions&&<track kind="captions" src={video.captions} srcLang="en" label="English" default/>}
     Your browser can’t play this video. <a href={video.mp4}>Download it instead</a>.
    </video>
   :<button type="button" className="vposter" onClick={()=>setPlaying(true)} aria-label={`Play video: ${video.title}`}>
     <img src={video.poster} alt="" loading="lazy"/>
     <span className="vplay" aria-hidden="true"><Play size={30} fill="currentColor"/></span>
     {label&&<span className="vlabel">{label}</span>}
    </button>}
 </figure>;
}

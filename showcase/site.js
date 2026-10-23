/* Privacy-safe, page-local GA4 for the user's shared blog stream.
   Never loads Google Analytics until an explicit Allow click. */
(()=>{
 'use strict';
 const key='cokacremote.showcase.analytics-consent.v1';
 const ga='G-4DYFKSNFBG'; // Verified GA4 web stream: shared DevTestudinidae blog.
 const banner=document.getElementById('analyticsConsent');
 const prefs=document.getElementById('privacyChoices');
 const gpc=navigator.globalPrivacyControl===true;
 let consent;
 try{consent=localStorage.getItem(key)}catch{consent=null}
 function hide(){if(banner)banner.hidden=true}
 function show(){if(banner)banner.hidden=false}
 function store(value){try{localStorage.setItem(key,value)}catch{}}
 function activate(){
   if(gpc||window.__cokaAnalyticsLoaded)return;
   window.__cokaAnalyticsLoaded=true;
   window.dataLayer=window.dataLayer||[];
   window.gtag=function(){window.dataLayer.push(arguments)};
   window.gtag('js',new Date());
   window.gtag('config',ga,{send_page_view:true});
   const script=document.createElement('script');
   script.async=true;
   script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(ga);
   script.setAttribute('data-coka-ga4','');
   document.head.append(script);
 }
 function choose(value){
   const previouslyLoaded=window.__cokaAnalyticsLoaded===true;
   consent=value;
   store(value);
   if(value==='allowed')activate();
   hide();
   // After revocation, reload to remove a previously loaded GA4 runtime.
   if(value==='rejected'&&previouslyLoaded)location.reload();
 }
 if(gpc){hide()} else if(consent==='allowed'){activate()} else if(consent==='rejected'){hide()} else {show()}
 banner?.addEventListener('click',event=>{
   const button=event.target.closest('button[data-consent]');
   if(!button)return;
   choose(button.dataset.consent==='allow'?'allowed':'rejected');
 });
 prefs?.addEventListener('click',show);
 document.addEventListener('click',event=>{
   const link=event.target.closest('a[data-track]');
   if(!link||consent!=='allowed'||!window.__cokaAnalyticsLoaded||gpc)return;
   window.gtag?.('event','showcase_cta_click',{cta_name:link.dataset.track,link_location:location.pathname,transport_type:'beacon'});
 });
})();

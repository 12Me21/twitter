// kill service workers hopefully
/*navigator.serviceWorker.getRegistrations().then(workers=>{
	for (let w of workers) {
		console.log("attempting to kill service worker:", w) 
		w.unregister()
	}
})*/

// this file gives us total control over cookies, from javascript.

////////////////////////
// intercept requests //
////////////////////////
chrome.webRequest.onBeforeSendHeaders.addListener(
	details => {
		return {requestHeaders: details.requestHeaders.filter(x => {
			// remove the `cookie` header set by the browser
			if (x.name.toLowerCase()=='cookie')
				return false
			// change the `x-12-cookie` header to `cookie` (to allow setting cookies manually with js)
			if (x.name=='x-12-cookie')
				x.name = 'cookie'
			return true
		})}
	},
	{urls: ['https://*.twitter.com/*']},
	['blocking', 'requestHeaders', 'extraHeaders'],
)

/////////////////////////
// intercept responses //
/////////////////////////
chrome.webRequest.onHeadersReceived.addListener(
	details => {
		let headers = details.responseHeaders.filter(header=>{
			// we need to modify this cors header due to a bug
			if (header.name.toLowerCase()=='access-control-allow-headers')
				header.value = "*"
			else if (header.name.toLowerCase()=='set-cookie')
				// rename cookie headers so we can read them from js
				header.name = 'x-12-set-cookie'
			else if (header.name=='content-security-policy')
				// this header is annoying
				return false
			else if (header.name=='location')
				// disable redirects
				header.name = 'x-12-location'
			return true
		})
		
		return {responseHeaders: headers}
	},
	{urls: ['https://*.twitter.com/*']},
	['blocking', 'responseHeaders', 'extraHeaders'],
)

// todo: we need to find a better method to completely block the real twitter html from loading.
// this file is extremely dangerous and greatly increases loading times etc.

// hghhhgfhifkjdsfoedoguwrk
/*chrome.webRequest.onBeforeRequest.addListener(
	function(details) {
		console.log('cw', details)
		return {cancel: true}
	},
	{urls: ['https://abs.twimg.com/responsive-web/client-web/*']},
	['blocking'],
)*/

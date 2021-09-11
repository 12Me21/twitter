// this file gives us total control over cookies, from javascript.

// modify/remove existing cookies
chrome.cookies.getAll({url: "https://twitter.com"}, function(cookies){
	console.log(cookies)
	for (let cookie of cookies) {
		// disable the httpOnly flag of these cookies, so we can read them from js
		if (cookie.name=='ct0' || cookie.name=='_twitter_sess' || cookie.name=='auth_token') {
			chrome.cookies.set({
				domain: cookie.domain,
				expirationDate: cookie.expirationDate,
				httpOnly: false,
				name: cookie.name,
				path: cookie.path,
				sameSite: cookie.sameSite,
				secure: cookie.secure,
				storeId: cookie.storeId,
				url: "https://twitter.com",
				value: cookie.value,
			})
		} else {
			// remove all other cookies
			chrome.cookies.remove({url: "https://twitter.com"+cookie.path, name: cookie.name, storeId: cookie.storeId})
		}
	}
})

// intercept requests
chrome.webRequest.onBeforeSendHeaders.addListener(
	details => {
		if (details.method=='OPTIONS')
			return
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

// intercept responses
chrome.webRequest.onHeadersReceived.addListener(
	details => {
		let headers = details.responseHeaders.filter(header=>{
			// remove all `set-cookie` headers, except: 'ct0', '_twitter_sess', 'auth_token'
			// (these are required for logging in)
			if (header.name.toLowerCase()=='access-control-allow-headers') {
				header.value = "*"
			} else if (header.name.toLowerCase()=='set-cookie') {
				if (!/(ct0|_twitter_sess|auth_token|att)=/y.test(header.value)) {
					return false
				}
				// remove the HttpOnly option from these headers
				// todo: maybe add a prefix or otherwise hide these somehow?
				// or put them in localstorage instead, idk
				
				// or perhaps, only store the cookies in the extension,
				// and have a request header that tells the extension to insert them in requests
				header.value = header.value.replace("; HTTPOnly", "")
			} else if (header.name=='content-security-policy') {
				return false
			}
			return true
		})
		
		return {responseHeaders: headers}
	},
	{urls: ['https://*.twitter.com/*']},
	['blocking', 'responseHeaders', 'extraHeaders'],
)


/*chrome.webRequest.onBeforeRequest.addListener(
	function(details) {
		if (details.type=='main_frame') {
			console.log("blocked main_frame request:", details)
			//return {cancel: true}
		}
	},
	{urls: ["https://twitter.com/*", "https://abs.twimg.com/*"]},
	["blocking"],
)*/

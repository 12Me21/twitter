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
		return {requestHeaders: details.requestHeaders.filter(x => {
			// remove `cookie` header set by the browser
			if (/^cookie$/i.test(x.name))
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
		for (header of details.responseHeaders) {
			// change `set-cookie` header to `x-12-set-cookie` so we can view it from js, without it having any effect
			if (/^set-cookie$/i.test(header.name))
				header.name = 'x-12-set-cookie'
		}
		
		return {responseHeaders: details.responseHeaders}
	},
	{urls: ['https://*.twitter.com/*']},
	['blocking', 'responseHeaders', 'extraHeaders'],
)

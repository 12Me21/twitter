/*chrome.webRequest.onBeforeSendHeaders.addListener(
	details => {
		return {requestHeaders: details.requestHeaders.filter(x => {
			//if (/^cookie$/i.test(x.name))
			//	return false
			if (x.name=='x-12-cookie')
				x.name = 'cookie'
			return true
		})}
	},
	{urls: ['https://*.twitter.com/*', 'http://*.twitter.com/*']},
	['blocking', 'requestHeaders', 'extraHeaders'],
)*/

chrome.webRequest.onHeadersReceived.addListener(
	details => {
		for (header of details.responseHeaders) {
			if (/^set-cookie$/i.test(header.name))
				header.name = 'x-12-set-cookie'
		}
			
		return {responseHeaders: details.responseHeaders}
	},
	{urls: ['https://*.twitter.com/*', 'http://*.twitter.com/*']},
	['blocking', 'responseHeaders', 'extraHeaders'],
)

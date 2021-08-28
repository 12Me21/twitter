chrome.webRequest.onBeforeSendHeaders.addListener(
	details => {
		return {requestHeaders: details.requestHeaders.filter(x => !/^cookie$/i.test(x.name))}
	},
	{urls: ['https://*.twitter.com/*', 'http://*.twitter.com/*']},
	['blocking', 'requestHeaders', 'extraHeaders'],
)

chrome.webRequest.onHeadersReceived.addListener(
	details => {
		return {responseHeaders: details.responseHeaders.filter(x => !/^set-cookie$/i.test(x.name))}
	},
	{urls: ['https://*.twitter.com/*', 'http://*.twitter.com/*']},
	['blocking', 'responseHeaders', 'extraHeaders'],
)

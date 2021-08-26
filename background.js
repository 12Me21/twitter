chrome.cookies.getAll({domain: "twitter.com"}, function(cookies) {
	for (let c of cookies) {
		console.log(c)
		chrome.cookies.remove({url: `https://${c.domain}${c.path}`, name: c.name})
	}
})

function encode_url_params(params, no_q) {
	let items = []
	for (let key in params) {
		items.push(encodeURIComponent(key)+'='+encodeURIComponent(params[key]))
	}
	let str = items.join("&")
	if (str.length && !no_q)
		str = "?"+str
	return str
}

class Auth {
	bearer = null
	querys = {}
	cookies = {}
	guest = null
	guest_token = null
	
	constructor() {
	}
	
	read_cookies() {
		let cookies = {}
		for (let item of document.cookie.split(";")) {
			let match = item.match(/^\s*([^]*?)="?([^]*?)"?\s*$/)
			if (match)
				cookies[match[1]] = decodeURIComponent(match[2])
		}
		return cookies
	}
	
	auth_headers() {
		if (this.guest) {
			return {
				'Authorization': "Bearer "+this.bearer,
				'x-guest-token': this.guest_token,
			}
		} else {
			return {
				// The bearer token is the same for all users and guests
				// it's extracted from: https://abs.twimg.com/responsive-web/client-web/main.91699ca5.js
				'Authorization': "Bearer "+this.bearer,
				// `x-csrf-token` must match the `ct0` cookie
				'x-csrf-token': this.cookies.ct0,
				// this header will be turned into a real cookie header by the browser extension
				'x-12-cookie': `_twitter_sess=${this.cookies._twitter_sess}; auth_token=${this.cookies.auth_token}; ct0=${this.cookies.ct0}`,
			}
		}
	}
	
	post_v11(path, body) {
		return fetch("https://twitter.com/i/api/1.1/"+url, {
			method: 'POST',
			headers: {
				'Content-Type': "application/x-www-form-urlencoded",
				...this.auth_headers(),
			},
			body: encode_url_params(body, true),
		}).then(x=>x.json())
	}
	
	get_v11(path) {
		return fetch("https://twitter.com/i/api/1.1/"+url, {
			headers: this.auth_headers()
		}).then(x=>x.json())
	}
	
	get_v2(path, params) {
		return fetch("https://twitter.com/i/api/2/"+path+encode_url_params(params), {
			headers: this.auth_headers()
		}).then(x=>x.json())
	}
	
	get_graphql(type, params) {
		let q = this.querys[type]
		return fetch(`https://twitter.com/i/api/graphql/${q.queryId}/${q.operationName}?variables=${encodeURIComponent(JSON.stringify(params))}`, {
			headers: this.auth_headers()
		}).then(x=>x.json()).then(x=>x.data)
	}
	
	post_graphql(type, params, body) {
		let q = this.querys[type]
		return fetch(`https://twitter.com/i/api/graphql/${q.queryId}/${q.operationName}`, {
			method: 'POST',
			headers: {
				'Content-Type': "application/json;charset=UTF-8",
				...this.auth_headers(),
			},
			body: JSON.stringify({variables: JSON.stringify(params), queryId: q.queryId}), // god you can't make this shit up
		}).then(x=>x.json()).then(x=>x.data)
	}	
	
	////////////////////////////////
	// Authentication/Login stuff //
	////////////////////////////////
	
	// this downloads a javascript file and extracts some values from it
	// these values don't often change, but there's no point in caching them
	// since the js file will be cached forever anyway
	async get_secrets() {
		console.info("fetching secrets")
		// awful hack.
		let text = await fetch("https://abs.twimg.com/responsive-web/client-web/main.91699ca5.js").then(x=>x.text())
		this.bearer = text.match(/a="Web-12",s="(.*?)"/)[1]
		this.querys = {}
		text.match(/\{queryId:".*?",operationName:".*?",operationType:".*?"\}/g).forEach(x=>{
			let d = JSON.parse(x.replace(/(\w+):/g,'"$1":'))
			this.querys[d.operationName] = d
		})
	}
	async get_guest_token() {
		console.info("fetching guest token")
		await fetch(
			"https://api.twitter.com/1.1/guest/activate.json",
			{method: "POST", headers: {authorization: "Bearer "+this.bearer}}
		).then(x=>x.json()).then(x=>{
			this.guest_token = x.guest_token
		})
	}
	async log_in(username, password) {
		let x = await fetch('https://twitter.com/sessions', {
			method: 'POST',
			headers: {
				'Content-Type': "application/x-www-form-urlencoded",
				'x-12-cookie': "_mb_tk=see_my_balls"
			},
			body: encode_url_params({
				'remember_me': 1,
				'authenticity_token': "see_my_balls",
				'session[username_or_email]': username,
				'session[password]': password,
			}, true),
		});
		this.cookies = this.read_cookies()
		return x
	}
	
	async init() {
		await this.get_secrets()
		this.cookies = this.read_cookies()
		if (this.cookies._twitter_sess) {
			this.guest = false
		} else {
			await this.get_guest_token()
			this.guest = true
		}
	}
}

// https://twitter.com/sessions

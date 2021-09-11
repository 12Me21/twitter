function encode_url_params(params) {
	let str = new URLSearchParams(params).toString()
	if (str)
		str = "?"+str
	return str
}

class Auth {
	bearer = null
	querys = {}
	cookies = {}
	guest = null
	guest_token = null
	csrf_token = "00000000000000000000000000000000" // what a crazy number to generate randomly!
	constructor() {
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
		this.mutations = {}
		text.match(/\{queryId:".*?",operationName:".*?",operationType:".*?"\}/g).forEach(x=>{
			let d = JSON.parse(x.replace(/(\w+):/g,'"$1":'))
			if (d.operationType=='query')
				this.querys[d.operationName] = d.queryId
			else if (d.operationType=='mutation')
				this.mutations[d.operationName] = d.queryId
		})
		this.bearer = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"
		
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
	
	// Try to log in with username and password
	// on success: reads cookies and returns true
	// on failure: returns false
	async log_in(username, password) {
		let x = await fetch('https://twitter.com/sessions', {
			method: 'POST',
			headers: {
				'x-12-cookie': "_mb_tk=see_my_balls"
			},
			body: new URLSearchParams({
				remember_me: 1,
				redirect_after_login: "/",
				authenticity_token: "see_my_balls",
				'session[username_or_email]': username,
				'session[password]': password,
			}),
		})
		this.read_cookies()
		if (x.url=="https://twitter.com/") {
			return [true, null]
		}
		return [false, x.url]
	}
	
	async login_verify(formdata, response) {
		formdata.set('challenge_response', response)
		//let query = .toString()
		let resp = await fetch("https://twitter.com/account/login_verification", {
			method: 'POST',
			headers: {
				//'Content-Type': 'application/x-www-form-urlencoded',
				'x-12-cookie': `_twitter_sess=${this.cookies._twitter_sess}; ct0=${this.csrf_token}; att=${this.cookies.att}`,
			},
			body: new URLSearchParams(formdata),
		})
		if (resp.url=="https://twitter.com/") {
			this.read_cookies()
			return true
		}
	}
	
	async init() {
		await this.get_secrets()
		this.read_cookies()
		if (this.cookies.auth_token) {
			this.guest = false
		} else {
			await this.get_guest_token()
			this.guest = true
		}
	}
	
	read_cookies() {
		let cookies = {}
		for (let item of document.cookie.split(";")) {
			let match = item.match(/^\s*([^]*?)="?([^]*?)"?\s*$/)
			if (match)
				cookies[match[1]] = decodeURIComponent(match[2])
		}
		this.cookies = cookies
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
				'x-csrf-token': this.csrf_token,
				// this header will be turned into a real cookie header by the browser extension
				'x-12-cookie': `_twitter_sess=${this.cookies._twitter_sess}; auth_token=${this.cookies.auth_token}; ct0=${this.csrf_token}`,
			}
		}
	}
}

// todo:
// at init: determine if user is logged in, somehow (hard, because the auth cookies are httponly)
// if not, request a guest token and enter guest mode
// on logged in requests, set an http header which our extension replaces with the auth cookies

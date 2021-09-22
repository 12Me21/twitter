function encode_url_params(params) {
	let str = new URLSearchParams(params).toString()
	if (str)
		return "?"+str
	return str
}

// you only need one of these.
// it just stores values that are the same for everyone,
// like the twitter.com bearer token.
class App {
	bearer = null
	querys = {}
	mutations = {}
	
	constructor() {
	}
	
	async init() {
		await this.get_secrets()
	}
	
	async get_secrets() {
		console.info("fetching secrets")
		// awful hack.
		let text = await fetch("https://abs.twimg.com/responsive-web/client-web/main.1aa07975.js").then(x=>x.text())
		//this.bearer = text.match(/a="Web-12",s="(.*?)"/)[1]
		this.bearer = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"
		this.querys = {}
		this.mutations = {}
		text.match(/\{queryId:".*?",operationName:".*?",operationType:".*?"\}/g).forEach(x=>{
			let d = JSON.parse(x.replace(/(\w+):/g,'"$1":'))
			if (d.operationType=='query')
				this.querys[d.operationName] = d.queryId
			else if (d.operationType=='mutation')
				this.mutations[d.operationName] = d.queryId
		})
	}
}

// this represents one logged-in account
class Auth {
	cookies = {}
	guest = null
	guest_token = null
	csrf_token = "00000000000000000000000000000000" // what a crazy number to generate randomly!
	
	constructor(app) {
		this.app = app
	}
	
	////////////////////////////////
	// Authentication/Login stuff //
	////////////////////////////////
	
	// this downloads a javascript file and extracts some values from it
	// these values don't ever change, but there's no point in caching them
	// since the js file will be cached forever anyway
	
	// TODO: catch the request to this file (which is made by the original twitter html page) and store the result so we can
	// 1: avoid this second request
	// 2: always get the newest version
	// i.e.: /^https:\/\/abs.twimg.com\/responsive-web\/client-web\/main\.\d+\.js$/
	
	
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
		let url = new URL(x.url)
		if (url.pathname=='/') {
			// normal login success
			this.login_from_cookies()
			return ['ok']
		} else if (url.pathname=='/account/login_verification') {
			// (two factor authentication)
			// finish downloading the page and extract the form:
			let html = await x.text()
			let doc = new DOMParser().parseFromString(html, 'text/html')
			let form = doc.getElementById('login-verification-form')
			return ['2fa', {form: new FormData(form), twitter_sess: this.cookies._twitter_sess, att: this.cookies.att}]
		} else {
			return ['unknown', x.url]
		}
	}
	
	async get_guest_token() {
		console.info("fetching guest token")
		let x = await fetch("https://api.twitter.com/1.1/guest/activate.json", {
			method: "POST",
			headers: {
				authorization: "Bearer "+this.app.bearer,
			},
		}).then(x=>x.json())
		this.guest_token = x.guest_token
	}

	// 2fa
	async login_verify(data, response) {
		let formdata = data.form
		formdata.set('challenge_response', response)
		let resp = await fetch('https://twitter.com/account/login_verification', {
			method: 'POST',
			headers: {
				'x-12-cookie': `_twitter_sess=${data.twitter_sess}; ct0=${this.csrf_token}; att=${data.att}`,
			},
			body: new URLSearchParams(formdata),
		})
		if (resp.url=="https://twitter.com/") {
			this.read_cookies()
			this.login_from_cookies()
			return true
		}
	}
	
	// todo: currently we always just get our tokens from the cookies
	// what we should do is: have a list of login details (i.e. _twitter_sess and auth_token values) saved in localstorage
	// when loading the page, it checks this list, and if it doesn't exist, imports the data from cookies
	// allow multiple accounts and switching etc.
	// also, to avoid interfering with twitter's own cookies, we should
	// add a prefix onto the set-cookie names
	// and also clear these custom cookies immediately after a request
	
	// there should be 3 init/login options
	// 1: grab tokens from twitter cookies
	// 2: new login from username/password etc.
	// 3: get tokens from localstorage (allows storing multiple accounts and switching easily)
	
	async init() {
		this.read_cookies()
		if (this.cookies.auth_token) {
			this.login_from_cookies()
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
	
	login_from_cookies() {
		this.twitter_sess = this.cookies._twitter_sess
		this.auth_token = this.cookies.auth_token
	}
	
	auth_headers() {
		if (this.guest) {
			return {
				'Authorization': "Bearer "+this.app.bearer,
				'x-guest-token': this.guest_token,
			}
		} else {
			return {
				// The bearer token is the same for all users and guests
				// it's extracted from: https://abs.twimg.com/responsive-web/client-web/main.91699ca5.js
				'Authorization': "Bearer "+this.app.bearer,
				// `x-csrf-token` must match the `ct0` cookie
				'x-csrf-token': this.csrf_token,
				// this header will be turned into a real cookie header by the browser extension
				'x-12-cookie': `_twitter_sess=${this._twitter_sess}; auth_token=${this.auth_token}; ct0=${this.csrf_token}`,
			}
		}
	}
	
	// this is normally the first significant request when you load the page.
	// it contains important info like your username, language, etc.
	async get_settings() {
		return fetch("https://twitter.com/i/api/1.1/account/settings.json"+encode_url_params({
			include_mention_filter: true,
			include_nsfw_user_flag: true,
			include_nsfw_admin_flag: true,
			include_ranked_timeline: true,
			include_alt_text_compose: true,
			ext: 'ssoConnections',
			include_country_code: true,
			include_ext_dm_nsfw_media_filter: true,
		}), {
			headers: this.auth_headers(),
		}).then(x=>x.json())
	}
}

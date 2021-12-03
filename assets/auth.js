function json(str) {
	try {
		return JSON.parse(str)
	} catch (e) {
		return undefined
	}
}

function decode_set_cookie(resp) {
	let str = resp.headers.get('x-12-set-cookie')
	let map = {}
	if (str) {
		for (let h of str.split(', ')) {
			let [_, name, value] = h.match(/^(.*?)="?(.*?)"?(;|$)/)
			map[name] = value
		}
	}
	console.log("decoded cookie: ", str, map)
	return map
}

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
	
	save_localstorage() {
		
	}
	
	// this downloads a javascript file and extracts some values from it
	// these values don't ever change, but there's no point in caching them
	// since the js file will be cached forever anyway
	
	// TODO: catch the request to this file (which is made by the original twitter html page) and store the result so we can
	// 1: avoid this second request
	// 2: always get the newest version
	// i.e.: /^https:\/\/abs.twimg.com\/responsive-web\/client-web\/main\.\d+\.js$/
	async get_secrets() {
		console.info("fetching secrets")
		// awful hack.
		let text = await fetch("https://abs.twimg.com/responsive-web/client-web/main.3bf20555.js").then(x=>x.text())
		//this.bearer = text.match(/a="Web-12",s="(.*?)"/)[1]
		this.bearer = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"
		this.querys = {}
		this.mutations = {}
		text.match(/\{queryId:".*?",operationName:".*?",operationType:".*?"/g).forEach(x=>{
			console.log(x)
			let d = JSON.parse(x.replace(/(\w+):/g,'"$1":')+"}")
			if (d.operationType=='query')
				this.querys[d.operationName] = d.queryId
			else if (d.operationType=='mutation')
				this.mutations[d.operationName] = d.queryId
		})
	}
}

// this represents one logged-in account

/* usage:
first, create an instance:
`let a = new Auth(app)`

=== Logging in === 
there are several ways to do this

## logging in as a guest:
`await a.login_guest()`

## if you were already logged in to the twitter client, you can steal the auth tokens from their cookies:
`a.init_from_cookies()`

## init using saved tokens:
`a.init_from_tokens(twitter_sess, auth_token)`

## logging in using username+password:
`a.log_in(name, password)`
`a.login_verify(code)` - only if 2fa is enabled

*/

// todo: we need to do better error checking here.
// there are many pathways to logging in, and we need to make sure that multiple logins are not tried on the same auth object at once

// todo: cookies should be entirely disabled, except when making the login and challenge response requests.
// ideally we could disable them there too, if i can figure out how to disable http redirects with the extension

class Auth {
	guest = null
	guest_token = null
	twitter_sess = null
	auth_token = null
	csrf_token = "00000000000000000000000000000000" // what a crazy number to generate randomly!
	ready = false
	form_2fa = null
	
	constructor(app) {
		this.app = app
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
				'x-12-cookie': `_twitter_sess=${this.twitter_sess}; auth_token=${this.auth_token}; ct0=${this.csrf_token}`,
			}
		}
	}
	
	// this is normally the first significant request when you load the page.
	// it contains important info like your username, language, etc.
	async get_settings() {
		if (this.guest)
			return null
		let data = await fetch("https://twitter.com/i/api/1.1/account/settings.json"+encode_url_params({
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
		console.log(data)
		this.settings = data
	}
	
	//////////////////
	// Init methods //
	//////////////////
	
	// all init/login requests will end in one of these two functions
	// - init_from_tokens()
	// - init_from_guest()
	init_from_tokens(sess, auth, id, save) {
		if (this.ready)
			throw "invalid auth init"
		this.twitter_sess = sess
		this.auth_token = auth
		this.uid = id
		if (this.twitter_sess && this.auth_token) {
			this.ready = true
			console.log('auth ready')
			// settings are requested asynchronously because most pages don't need them.
			// if you need them, you can `await auth.settings_promise`
			this.settings_promise = this.get_settings()
			this.localstorage_save()
		}
	}
	
	init_from_guest(token) {
		if (this.ready)
			throw "invalid auth init"
		this.guest_token = token
		if (this.guest_token) {
			this.guest = true
			this.ready = true
			console.log('guest auth ready')
		}
	}
	
	// request guest tokens
	
	async login_guest() {
		console.info("fetching guest token")
		let x = await fetch("https://api.twitter.com/1.1/guest/activate.json", {
			method: 'POST',
			headers: {
				authorization: "Bearer "+this.app.bearer,
			},
		}).then(x=>x.json())
		this.init_from_guest(x.guest_token)
	}
	
	///
	
	async init_auto() {
		let c = localStorage.getItem('12-current')
		let acc = json(localStorage.getItem('12-accounts')) || {}
		if (acc[c]) {
			let tokens = acc[c]
			this.init_from_tokens(tokens.twitter_sess, tokens.auth_token, tokens.uid)
			return
		}
		
		for (let name in acc) {
			let tokens = acc[name]
			this.init_from_tokens(tokens.twitter_sess, tokens.auth_token, tokens.uid)
			return
		}
		await this.login_guest()
	}
	
	// Try to log in with username and password
	// on success: reads cookies and returns true
	// on failure: returns false
	async log_in(username, password) {
		let x = await fetch('https://twitter.com/sessions', {
			method: 'POST',
			headers: {
				'x-12-cookie': "_mb_tk=see_my_balls"+Date.now()
			},
			body: new URLSearchParams({
				remember_me: 1,
				redirect_after_login: "/",
				authenticity_token: "see_my_balls"+Date.now(),
				'session[username_or_email]': username,
				'session[password]': password,
			}),
		})
		let location = x.headers.get('x-12-location')
		let url = new URL(location)
		console.log("response", x)
		if (url.pathname=="/") {
			// normal login success
			let c = decode_set_cookie(x)
			this.init_from_tokens(c._twitter_sess, c.auth_token, c.twid.replace("u=",""), true)
			return ['ok']
		} else if (url.pathname=='/account/login_verification') {
			// (two factor authentication)
			let c = decode_set_cookie(x)
			this.twitter_sess = c._twitter_sess
			this.att = c.att
			let r2 = await fetch(location, {
				method: 'GET',
				headers: {
					'x-12-cookie': `_twitter_sess=${this.twitter_sess}; ct0=${this.csrf_token}; att=${this.att}`
				}
			})
			let html = await r2.text()
			let doc = new DOMParser().parseFromString(html, 'text/html')
			let form = doc.getElementById('login-verification-form')
			this.form_2fa = new FormData(form)
			return ['2fa']
		} else {
			return ['unknown', location]
		}
	}
	
	// ok this is slightly messed up i think it's doing some fucked up things with cookies again but it works SOMETIMES
	// 2fa
	async login_verify(response) {
		this.form_2fa.set('challenge_response', response)
		let resp = await fetch('https://twitter.com/account/login_verification', {
			method: 'POST',
			headers: {
				'x-12-cookie': `_twitter_sess=${this.twitter_sess}; ct0=${this.csrf_token}; att=${this.att}`,
			},
			body: new URLSearchParams(this.form_2fa),
		})
		if (resp.headers.get('x-12-location')=="https://twitter.com/") {
			let c = decode_set_cookie(resp)
			this.init_from_tokens(c._twitter_sess, c.auth_token, c.twid.replace("u=",""), true)
			return true
		}
	}
	
	save() {
		return {
			twitter_sess: this.twitter_sess,
			auth_token: this.auth_token,
			uid: this.uid,
		}
	}
	
	async set_current() {
		await this.settings_promise
		localStorage.setItem('12-current', this.settings.screen_name)
	}
	
	async localstorage_save() {
		if (!this.ready)
			return //error?
		await this.settings_promise
		let x = json(localStorage.getItem('12-accounts')) || {}
		x[this.settings.screen_name] = this.save()
		localStorage.setItem('12-accounts', JSON.stringify(x))
	}
	
}

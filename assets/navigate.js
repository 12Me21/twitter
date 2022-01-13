function blink() {
	return new Promise(r => setTimeout(r,0))
}

function wait(n) {
	return new Promise(r => setTimeout(r,n))
}

let auth
let query
let mutate
let initial_pop
let auth_app
let ready = false
let buffered_location

// todo: loading indicator when requesting more of a timeline

// never assign to `auth` directly. use this function to switch the "current" account instead
async function swap_accounts(na) {
	auth = na
	auth.set_current()
	// really, now that I think about it, 
	// the mutate/query objs should maybe be inside of auth rather than the other way around
	mutate = new Mutate(auth)
	if (query)
		query.abort()
	query = null
	auth.settings_promise.then(x=>{
		$profile_link.textContent = auth.settings.screen_name
		$profile_link.href = "/"+auth.settings.screen_name
	})
	// 4: reload page
	//await render_from_location()
}

// called when the page loads
async function onload() {
	$gallery_download.onclick = download_link_onclick
	$image_viewer.onclick = function(){ this.hidden=true }
	
	auth_app = new App()
	await auth_app.init()
	auth = new Auth(auth_app)
	auth.init_auto()
	
	let accts = json(localStorage.getItem('12-accounts')) || {}
	for (let name in accts) {
		let x = document.createElement('button')
		x.textContent = name
		let tokens = accts[name]
		x.onclick = function() {
			let a = new Auth(auth_app)
			a.init_from_tokens(tokens.twitter_sess, tokens.auth_token, tokens.uid)
			swap_accounts(a)
		}
		$account_list.append(x)
	}
	
	swap_accounts(auth)
	
	//mutate = new Mutate(auth)
	
	// NOW we are ready
	ready = true
	
	// some browsers trigger `popstate` when the page loads, and some don't
	// so we only run this if that didn't happen
	if (!initial_pop || buffered_location) {
		initial_pop = true
		await render_from_location()
	}
}

function scroll_add(x) {
	$main_scroll.append(x)
}

function go_to(url) {
	history.pushState(null, "", url)
	render(url)
}

//if (document.readyState == 'loading')
window.addEventListener('load', onload)
//else
//	onload()

// called when the browser navigates forward/backward
window.onpopstate = function() {
	if (ready) {
		initial_pop = true
		render_from_location()
	} else {
		// hopefully this only happens on the initial load.
		// it may also happen if the user clicks a link before the page is fully initialized
		// regardless, it should be fine, as the page will be updated properly
		// in the onload function
	}
}

// render a page based on the current url
function render_from_location() {
	render(window.location)
}

class View {
	constructor(path, request, render) {
		this.path = path
		this.request = request
		this.render = render
	}
	
	check_path(url) {
		if (url.path.length!=this.path.length)
			return false
		for (let i=0; i<this.path.length; i++) {
			let x = this.path[i]
			if (x instanceof RegExp) {
				if (!x.test(url.path[i]))
					return false
			} else if (typeof x == 'string') {
				if (x!=url.path[i]) 
					return false
			} else if (x !== true) {
				return false // invalid
			}
		}
		return true
	}
}

// todo: we should have separate elements for like
// - the timeline you're viewing
// - a tweet you're viewing
// - maybe user profile too?
// - perhaps like, every time you navigate to a new thing, we create a new scroller, and store like, up to 3 at a time, so you can easily go back to the previous thing. sorta like tweetdeck

// todo: some way to alter the url during/after rendering
let USER_NAME = /^@?\w+$/
let NUMBER = /^\d+$/

let views = [
	//
	new View(
		[USER_NAME, 'status', NUMBER, 'retweets', 'with_comments'],
		(url) => query.quote_tweets(url.path[2]),
		function(tlr) {
			let x = new Timeline(tlr)
			scroll_add(x.elem)
		}
	),
	// 
	new View(
		['i', 'events', NUMBER],
		async (url) => {
			let id = url.path[2]
			let tlr = query.moment_tweets(id)
			let r1 = query.moment(id)
			return [await r1, await tlr]
		},
		function([data1, tlr]) {
			// todo: render moment data
			let x = new Timeline(tlr)
			scroll_add(x.elem)
		}
	),
	new View(
		[USER_NAME, 'lists'],
		async (url) => {
			let user = await query.user(url.path[0])
			let tlr = user && await query.user_lists(user.id_str)
			return [user, tlr]
		},
		function([user, tlr]) {
			scroll_add(draw_profile(user))
			if (tlr) {
				let x = new Timeline(tlr)
				scroll_add(x.elem)
			}
		}
	),
	new View(
		['i', 'lists', NUMBER],
		async (url) => {
			let id = url.path[2]
			let list = query.list(id)
			let tlr = query.list_tweets(id)
			return [await list, await tlr]
		},
		function([list, tlr]) {
			scroll_add(draw_list(list.list))
			if (tlr) {
				let x = new Timeline(tlr)
				scroll_add(x.elem)
			}
		}
	),
	new View(
		['search'],
		async (url) => {
			let params = new URLSearchParams(url.search)
			let q = params.get('q')
			let tlr = null
			if (q)
				tlr = await query.search(q)
			return [q, tlr]
		},
		function([q, tlr]) {
			let ids = template($SearchBox)
			// later: this will be an event on the customElement etc etc.
			ids.submit.onclick = x => {
				go_to(search_url(ids.input.value))
			}
			ids.input.value = q
			scroll_add(ids.main)
			if (tlr) {
				let x = new Timeline(tlr)
				scroll_add(x.elem)
			}
		}
	),
	new View(
		['logout'],
		(url) => mutate.log_out(), //todo: should be button
		function(status) {
			if (status) {
				go_to("https://twitter.com/login")
			}
		},
	),
	new View(
		['login'],
		null,
		function(data) {
			let ids = template($LoginForm)
			let output = ids.output
			let auth2 = new Auth(auth_app)
			ids.main.onsubmit = async function(e) {
				e.preventDefault()
				let username = e.target.username.value
				let password = e.target.password.value
				let [status, ext] = await auth2.log_in(username, password)
				if (status=='ok') {
					ids.output.textContent = "Logged in!"
					swap_accounts(auth2)
					go_to("https://twitter.com/home")
				} else if (status=='2fa') {
					ids.extra.hidden = false
					ids.code_submit.onclick = async function(e) {
						if (await auth2.login_verify(ids.code.value)) {
							ids.output.textContent = "Logged in!"
							swap_accounts(auth2)
							go_to("https://twitter.com/home")
						}
					}
				} else {
					ids.output.textContent = "Login failed. You may need to visit the following page: "
					let a = document.createElement('a')
					a.href = ext
					a.textContent = ext
					ids.output.append(a)
				}
			}
			scroll_add(ids.main)
		},
	),
	new View(
		['compose','tweet'],
		null,
		function(data) {
			let editable = new Editable({browserSpellcheck: false})
			
			let ids = template($TweetComposer)
			editable.add(ids.textarea)
			
			scroll_add(ids.main)
			ids.send.onclick = async function() {
				let resp = await mutate.tweet(ids.textarea.value)
				go_to("https://twitter.com/heck/status/"+resp.data.create_tweet.tweet_results.result.rest_id)
			}
		}
	),
	new View(
		[USER_NAME, 'status', NUMBER],
		(url) => query.tweet(url.path[2]),
		function(tlr) {
			let x = new Timeline(tlr)
			scroll_add(x.elem)
		}
	),
	new View(
		['i', 'latest'],
		(url) => query.latest(),
		function(tlr) {
			let x = new Timeline(tlr)
			scroll_add(x.elem)
		}
	),
	new View(
		['home'],
		(url) => query.home(),
		function(tlr) {
			let x = new Timeline(tlr)
			scroll_add(x.elem)
		}
	),
	new View(
		['notifications'],
		(url) => query.notifications(),
		function(tlr) {
			let x = new Timeline(tlr)
			scroll_add(x.elem)
		}
	),
	new View(
		[USER_NAME, 'followers'],
		async function(url) {
			let user = await query.user(url.path[0])
			let tlr = user && await query.followers(user.id_str)
			return [user, tlr]
		},
		function([user, tlr]) {
			scroll_add(draw_profile(user))
			if (tlr) {
				let x = new Timeline(tlr)
				scroll_add(x.elem)
			}
		}
	),
	new View(
		[USER_NAME, 'following'],
		async function(url) {
			let user = await query.user(url.path[0])
			let tlr = user && await query.following(user.id_str)
			return [user, tlr]
		},
		function([user, tlr]) {
			scroll_add(draw_profile(user))
			if (tlr) {
				let x = new Timeline(tlr)
				scroll_add(x.elem)
			}
		}
	),
	new View(
		[USER_NAME, 'likes'],
		async function(url) {
			let user = await query.user(url.path[0])
			let tlr = user && await query.user_likes(user.id_str)
			return [user, tlr]
		},
		function([user, tlr]) {
			scroll_add(draw_profile(user))
			if (tlr) {
				let x = new Timeline(tlr)
				scroll_add(x.elem)
			}
		}
	),
	new View(
		[USER_NAME, 'like_search'],
		async function(url) {
			//let params = new URLSearchParams(url.search)
			//let q = params.get('q')
			
			let user = await query.user(url.path[0])
			let tlr = await query.user_likes(user.id_str)
			return tlr
		},
		function(tlr) {
			//scroll_add(draw_profile(user))
			if (tlr) {
				let x = new Search(tlr)
				scroll_add(x.elem)
			}
		}
	),
	// CUSTOM: add/remove user from lists
	// replaces ambiguous url twitter.com/i/lists/add_member
	new View(
		[USER_NAME, 'add_member'],
		async function(url) {
			let user = await query.user(url.path[0])
			let tlr = user && await query.list_ownerships(user.id_str)
			return [user, tlr]
		},
		function([user, tlr]) {
			window.list_user_hack = user.id_str
			scroll_add(draw_profile(user))
			if (tlr) {
				let x = new Timeline(tlr)
				scroll_add(x.elem)
			}
		}
	),
	new View(
		['i', 'bookmarks'],
		(url) => query.bookmarks(),
		function(tlr) {
			let x = new Timeline(tlr)
			scroll_add(x.elem)
		},
	),
	// twitter.com/<name>
	// todo: a lot of pages rely on requesting user info
	// this should be, perhaps, cached, and
	// we definitely need to clean up this code
	new View(
		[USER_NAME],
		async (url) => {
			let user = await query.user(url.path[0])
			if (user) {
				let tlr = query.user_tweets(user.id_str)
				let resp3 = query.biz_profile(user.id_str)
				let resp2 = query.friends_following(user.id_str, 10)
				return [user, await tlr, await resp3, await resp2]
			} else {
				return [user]
			}
		},
		([user, tlr, biz, followo]) => {
			if (user) {
				if (biz?.rest_id == user.id_str)
					user._biz = biz
				if (followo?.users?.length)
					user._friends = followo.users
			}
			scroll_add(draw_profile(user))
			if (tlr) {
				let x = new Timeline(tlr)
				scroll_add(x.elem)
			}
		}
	),
	new View(
		[USER_NAME, 'with_replies'],
		async (url) => {
			let user = await query.user(url.path[0])
			let tlr = user && await query.user_all_tweets(user.id_str)
			return [user, tlr]
		},
		([user, tlr]) => {
			scroll_add(draw_profile(user))
			if (tlr) {
				let x = new Timeline(tlr)
				scroll_add(x.elem)
			}
		}
	),
	new View(
		[USER_NAME, 'media'],
		async (url) => {
			let user = await query.user(url.path[0])
			let tlr = user && await query.user_media(user.id_str)
			return [user, tlr]
		},
		([user, tlr]) => {
			scroll_add(draw_profile(user))
			if (tlr) {
				let x = new Timeline(tlr)
				scroll_add(x.elem)
			}
		}
	),
]

let unknown_view = new View(
	[],
	async function(url) {
		return url
	},
	function (data) {
		$main_scroll.append("unknown page :"+data)
	}
)

let error_view = new View(
	[],
	async function(e) { return e },
	function (e) {
		console.log("ev", e)
		$main_scroll.append("error rendering:\n"+e.stack)
	}
)

async function render(url) {
	console.log("beginning render of: "+url)
	document.documentElement.classList.add('f-loading')
	// parse the url path
	url = new URL(url)
	url.path = url.pathname.substr(1).split("/")
	// figure out what page we're rendering
	let view = views.find(view => view.check_path(url)) || unknown_view
	
	// abort all requests from the previous page
	// todo: really we just want to abort some things (i.e. downloading data)
	// and not, i.e. a Reaction request or something
	if (query)
		query.abort()
	
	query = new Query(auth) //todo: we can maybe store othre data here? like url
	
	console.log("view:", view.path)
	
	// first: call the .request method, which downloads the data needed to render the page
	// until that finishes, we leave the user on the previous page
	// some views don't have the .request method, and are rendered immediately
	let resp
	if (view.request) {
		try {
			resp = await view.request(url)
		} catch (e) {
			if (e instanceof DOMException && e.name=='AbortError') {
				// request was aborted, do nothing
				return
			}
			console.error(e)
			view = error_view
			resp = await view.request(e)
		}
	} else {
		resp = url
	}
	// now that the request has finished, we clear the timeline
	$main_scroll.replaceChildren()
	$main_scroll.scrollTop = 0
	// and call the render function to display the data
	document.documentElement.classList.add('f-rendering')
	document.documentElement.classList.remove('f-loading')
	// i defer this so the color has time to change
	console.log('requesting a render')
	await blink();
	try {
		view.render(resp)
	} catch (e) {
		console.error(e)
		view = error_view
		resp = view.request(e)
		view.render(resp)
	}
	document.documentElement.classList.remove('f-rendering')
}

async function test() {
	
	let t = await query.user_likes(auth.uid)
	window.RES = []
	while (1) {
		let x = await t.get()
		//console.log(x)
		//return;
		let s = JSON.stringify(x)
		if (/[Pp]oke/.test(s))
			window.RES.push(s)
		console.log("next")
		await wait(1000);
		//r.push()
	}
}

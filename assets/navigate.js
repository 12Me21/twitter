let auth
let query
let mutate
let initial_pop
let auth_app
let ready = false
let buffered_location

async function swap_accounts() {
	// 1: make new auth object
	auth = new Auth(auth_app)
	// 2: log in to new auth, either:
	//  - from localstorage
	//  - from twitter cookies
	//  - from new login
	//...
	// 3: create new mutate/query objects
	// really, now that I think about it, 
	// the mutate/query objs should maybe be inside of auth rather than the other way around
	mutate = new Mutate(auth)
	if (query)
		query.abort()
	query = null
	// 4: reload page
	await render_from_location()
}

// called when the page loads
async function onload() {
	// TODO: all this stuff can be done BEFORE onload
	//	init app
	auth_app = new App()
	await auth_app.init()
	// init auth
	auth = new Auth(auth_app)
	await auth.init()
	auth.settings = await auth.get_settings()
	// 
	mutate = new Mutate(auth)
	
	
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

class ClickAction {
	constructor(check, handle) {
		this.checker = check
		this.handler = handle
	}
	
	attempt(elem, event) {
		if (this.checker(elem)) {
			event.preventDefault()
			try {
				this.handler(elem, event)
			} finally {
				return true
			}
		}
		return false
	}
	
	static handle_event(event, actions) {
		for (let elem of event.path) {
			if (actions.find(a => a.attempt(elem, event)))
				break;
		}
	}
}

click_actions = [
	new ClickAction(
		elem => elem instanceof HTMLAnchorElement && elem.origin==window.location.origin && !elem.download,
		function(elem) {
			go_to(elem.href)
		}
	),
	new ClickAction(
		elem => elem instanceof HTMLButtonElement && elem.dataset.interact,
		async function(elem) {
			let tweet = elem.closest('tl-tweet')
			let type = elem.dataset.interact
			let id = tweet.dataset.id
			// this is repetitive
			if (type=='retweet') {
				if (elem.classList.contains('own-reaction')) {
					elem.disabled = true
					mutate.delete_retweet(id).then(x=>{
						elem.classList.remove('own-reaction')
					}).trap(ApiError, x=>{
						console.log("unretweet failed?", x)
					}).finally(x=>{
						elem.disabled = false
					})
				} else {
					elem.disabled = true
					mutate.retweet(id).then(x=>{
						elem.classList.add('own-reaction')
					}).trap(ApiError, x=>{
						console.log("retweet failed?", x)
					}).finally(x=>{
						elem.disabled = false
					})
				}
			} else if (type=='like') {
				if (elem.classList.contains('own-reaction')) {
					elem.disabled = true
					mutate.delete_react(id).then(x=>{
						elem.classList.remove('own-reaction')
					}).trap(ApiError, x=>{
						console.log("reaction failed?", x)
					}).finally(x=>{
						elem.disabled = false
					})
				} else {
					elem.disabled = true
					mutate.react(id).then(x=>{
						elem.classList.add('own-reaction')
					}).trap(ApiError, x=>{
						console.log("reaction failed?", x)
					}).finally(x=>{
						elem.disabled = false
					})
				}
			} else if (type=='bookmark') {
				elem.disabled = true
				mutate.bookmark(id).then(x=>{
					elem.classList.add('own-reaction')
				}).trap(ApiError, x=>{
					console.log('bookmark err', x)
					// idk
				}).finally(x=>{
					elem.disabled = false
				})
			}
		}
	),
]

document.addEventListener('click', function(e) {
	ClickAction.handle_event(e, click_actions)
}, false)

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
	initial_pop = true
	if (ready)
		render_from_location()
	else
		buffered_location = true
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

let views = [
	// todo: log in screen to add new account
	new View(
		['account', 'add'],
		null,
		function() {
			
		}
	),
	// todo: screen to select between accounts
	new View(
		['account', 'switch'],
		null,
		function() {
			
		}
	),
	new View(
		[true, 'lists'],
		async (url) => {
			let user = await query.user(url.path[0])
			if (user) {
				let resp = await query.user_lists(user.id_str)
				return [user, resp.user.result.timeline.timeline]
			} else {
				return [user, null]
			}
		},
		function(data) {
			scroll_add(draw_profile(data[0]))
			if (data[1]) {
				let x = new Timeline(data[1])
				scroll_add(x.elem)
			}
		}
	),
	new View(
		['search'],
		async (url) => {
			let params = new URLSearchParams(url.search)
			let query = params.get('q')
			return [query, await query.search(query)]
		},
		function([query, resp]) {
			let ids = template($SearchBox)
			// later: this will be an event on the customElement etc etc.
			ids.submit.onclick = x => {
				go_to(search_url(ids.input.value))
			}
			ids.input.value = query
			scroll_add(ids.main)
			let x = new Timeline(resp.timeline, resp.globalObjects)
			scroll_add(x.elem)
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
			ids.main.onsubmit = async function(e) {
				e.preventDefault()
				let username = e.target.username.value
				let password = e.target.password.value
				let [status, ext] = await auth.log_in(username, password)
				if (status=='ok') {
					ids.output.textContent = "Logged in!"
					go_to("https://twitter.com/home")
				} else if (status=='2fa') {
					ids.extra.hidden = false
					ids.code_submit.onclick = async function(e) {
						if (await auth.login_verify(ext, ids.code.value)) {
							ids.output.textContent = "Logged in!"
							go_to("https://twitter.com/home")
						}
					}
				} else {
					ids.output.textContent = "Login failed. You may need to visit the following page: "
					let a = document.createElement('a')
					a.href = error
					a.textContent = error
					e.target.output.append(a)
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
	// twitter.com/<name>/status/<id>
	new View(
		[/^@?\w+$/, 'status', /^\d+$/],
		(url) => query.tweet(url.path[2]),
		function(data) {
			if (data && data.threaded_conversation_with_injections) {
				let x = new Timeline(data.threaded_conversation_with_injections)
				scroll_add(x.elem)
			}
		}
	),
	// twitter.com/home
	new View(
		['home'],
		(url) => query.home(url.searchParams.get('cursor')),
		function(data) {
			let x = new Timeline(data.timeline, data.globalObjects)
			scroll_add(x.elem)
		}
	),
	// twitter.com/notifications
	new View(
		['notifications'],
		(url) => query.notifications(),
		function(data) {
			let x = new Timeline(data.timeline, data.globalObjects)
			scroll_add(x.elem)
		}
	),
	// twitter.com/<name>/followers
	new View(
		[true, 'followers'],
		async function(url) {
			let user = await query.user(url.path[0])
			if (user) {
				let likes = await query.followers(user.id_str)
				return [user, likes.user.result.timeline.timeline]
			} else {
				return [user, null]
			}
		},
		function(data) {
			scroll_add(draw_profile(data[0]))
			if (data[1]) {
				let x = new Timeline(data[1])
				scroll_add(x.elem)
			}
		}
	),
	// twitter.com/<name>/likes
	new View(
		[true, 'likes'],
		async function(url) {
			let user = await query.user(url.path[0])
			if (user) {
				let likes = await query.user_likes(user.id_str)
				return [user, likes.user.result.timeline.timeline]
			} else {
				return [user, null]
			}
		},
		function(data) {
			scroll_add(draw_profile(data[0]))
			if (data[1]) {
				let x = new Timeline(data[1])
				scroll_add(x.elem)
			}
		}
	),
	// twitter.com/i/bookmarks
	new View(
		['i', 'bookmarks'],
		(url) => query.bookmarks(),
		(data) => {
			let x = new Timeline(data)
			scroll_add(x.elem)
		}
	),
	// twitter.com/<name>
	new View(
		[/^@?\w+$/],
		async (url) => {
			let user = await query.user(url.path[0])
			if (user) {
				let profile = await query.profile(user.id_str)
				return [user, profile]
			} else {
				return [user, null]
			}
		},
		(data) => {
			scroll_add(draw_profile(data[0]))
			if (data[1]) {
				let x = new Timeline(data[1])
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
			resp = view.request(e)
		}
	} else {
		resp = url
	}
	// now that the request has finished, we clear the timeline
	$main_scroll.replaceChildren()
	$main_scroll.scrollTop = 0
	// and call the render function to display the data
	try {
		view.render(resp)
	} catch (e) {
		console.error(e)
		view = error_view
		resp = view.request(e)
		view.render(resp)
	}
	document.documentElement.classList.remove('f-loading')
}

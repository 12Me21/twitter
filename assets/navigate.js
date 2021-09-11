let auth;
let current;
let initial_pop;

// called when the page loads
async function onload() {
	auth = new Auth();
	await auth.init()
	// some browsers trigger `popstate` when the page loads, and some don't
	// so we only run this if that didn't happen
	if (!initial_pop) {
		initial_pop = true
		await render_from_location()
	}
}

/*document.addEventListener('click', function(e) {
	for (let elem of e.path) {
		if (elem instanceof HTMLAnchorElement && elem.origin==window.location.origin) {
			e.preventDefault()
			console.log("handle navigation to:", elem.href)
			break;
		}
	}
})*/

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
	render_from_location()
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

/*function text_length(text) {
	[0x0000-0x10FF]
	[U+2000-U+200D]
	[U+2010-U+201F]
	[U+2032-U+2037]
}*/

// todo: we should have separate elements for like
// - the timeline you're viewing
// - a tweet you're viewing
// - maybe user profile too?
// - perhaps like, every time you navigate to a new thing, we create a new scroller, and store like, up to 3 at a time, so you can easily go back to the previous thing. sorta like tweetdeck

// an 'instruction' contains 0 or more 'entries'
function handle_instructions(insts, objects) {
	for (let inst of insts.instructions) {
		if (objects) {
			if (inst.addEntries) {
				for (let entry of inst.addEntries.entries)
					add_entry(entry, objects)
			} else {
				timeline_add("instruction: "+JSON.stringify(inst))
			}
		} else {
			let type = inst.type
			if (type=='TimelineAddEntries') {
				for (let entry of inst.entries)
					add_entry(entry)
			} else if (type=='TimelinePinEntry') {
				add_entry(inst.entry)
			} else {
				timeline_add("instruction: "+JSON.stringify(inst))
			}
		}
	}
}

// todo: some way to alter the url during/after rendering

function timeline_add(elem) {
	$main_scroll.append(elem)
}

let views = [
	new View(
		[true, 'lists'],
		async (url) => {
			let user = await current.get_user(url.path[0])
			if (user) {
				let resp = await current.get_user_lists(user.id_str)
				return [user, resp.user.result.timeline.timeline]
			} else {
				return [user, null]
			}
		},
		function(data) {
			timeline_add(draw_profile(data[0]))
			if (data[1])
				handle_instructions(data[1])
		}
	),
	new View(
		['account', 'login_verification'],
		(url) => current.get_verify_form(url.search),
		function(formdata) {
			let x = document.createElement('input')
			let y = document.createElement('button')
			y.textContent = 'submit'
			timeline_add(x)
			timeline_add(y)
			y.onclick = async function(e) {
				if (await auth.login_verify(formdata, x.value)) {
					e.target.output.value = "Logged in!"
					go_to("https://twitter.com/home")
				}
			}
		}
	),
	new View(
		['search'],
		async (url) => {
			let params = new URLSearchParams(url.search)
			let query = params.get('q')
			return [query, await current.search(query)]
		},
		function([query, resp]) {
			let ids = template($SearchBox)
			// later: this will be an event on the customElement etc etc.
			ids.submit.onclick = x => {
				go_to(search_url(ids.input.value))
			}
			ids.input.value = query
			timeline_add(ids.main)
			handle_instructions(resp.timeline, resp.globalObjects)
		}
	),
	new View(
		['logout'],
		(url) => current.log_out(), //todo: should be button
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
			ids.main.onsubmit = async function(e) {
				e.preventDefault()
				let username = e.target.username.value
				let password = e.target.password.value
				let [status, error] = await auth.log_in(username, password)
				if (status) {
					e.target.output.value = "Logged in!"
					go_to("https://twitter.com/home")
				} else {
					e.target.output.textContent = "Login failed. You may need to visit the following page: "
					let a = document.createElement('a')
					a.href = error
					a.textContent = error
					e.target.output.append(a)
				}
			}
			timeline_add(ids.main)
		},
	),
	new View(
		['compose','tweet'],
		null,
		function(data) {
			let ids = template($TweetComposer)
			timeline_add(ids.main)
			ids.send.onclick = async function() {
				let resp = await current.create_tweet(ids.textarea.value)
				go_to("https://twitter.com/heck/status/"+resp.create_tweet.tweet_results.result.rest_id)
			}
		}
	),
	// twitter.com/<name>/status/<id>
	new View(
		[/^@?\w+$/, 'status', /^\d+$/],
		(url) => current.get_tweet(url.path[2]),
		function(data) {
			if (data && data.threaded_conversation_with_injections) {
				handle_instructions(data.threaded_conversation_with_injections)
			}
		}
	),
	// twitter.com/home
	new View(
		['home'],
		(url) => current.get_home(),
		function(data) {
			handle_instructions(data.timeline, data.globalObjects)
		}
	),
	// twitter.com/notifications
	new View(
		['notifications'],
		(url) => current.get_notifications(),
		function(data) {
			handle_instructions(data.timeline, data.globalObjects)
		}
	),
	// twitter.com/<name>/followers
	new View(
		[true, 'followers'],
		async function(url) {
			let user = await current.get_user(url.path[0])
			if (user) {
				let likes = await current.get_followers(user.id_str)
				return [user, likes.user.result.timeline.timeline]
			} else {
				return [user, null]
			}
		},
		function(data) {
			timeline_add(draw_profile(data[0]))
			if (data[1])
				handle_instructions(data[1])
		}
	),
	// twitter.com/<name>/likes
	new View(
		[true, 'likes'],
		async function(url) {
			let user = await current.get_user(url.path[0])
			if (user) {
				let likes = await current.get_user_likes(user.id_str)
				return [user, likes.user.result.timeline.timeline]
			} else {
				return [user, null]
			}
		},
		function(data) {
			timeline_add(draw_profile(data[0]))
			if (data[1])
				handle_instructions(data[1])
		}
	),
	// twitter.com/i/bookmarks
	new View(
		['i', 'bookmarks'],
		(url) => current.get_bookmarks(),
		(data) => {
			handle_instructions(data)
		}
	),
	// twitter.com/<name>
	new View(
		[/^@?\w+$/],
		async (url) => {
			let user = await current.get_user(url.path[0])
			if (user) {
				let profile = await current.get_profile(user.id_str)
				return [user, profile]
			} else {
				return [user, null]
			}
		},
		(data) => {
			$main_scroll.append(draw_profile(data[0]))
			if (data[1])
				handle_instructions(data[1])
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
	// parse the url path
	url = new URL(url)
	url.path = url.pathname.substr(1).split("/")
	// figure out what page we're rendering
	let view = views.find(view => view.check_path(url)) || unknown_view
	
	// abort all requests from the previous page
	// todo: really we just want to abort some things (i.e. downloading data)
	// and not, i.e. a Reaction request or something
	if (current)
		current.abort()
	
	current = new Query(auth) //todo: we can maybe store othre data here? like url
	
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
}

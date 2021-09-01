let auth;
let initial_pop;

// called when the page loads
async function onload() {
	auth = new Auth();
	await auth.log_in()
	// some browsers trigger `popstate` when the page loads, and some don't
	// so we only run this if that didn't happen
	if (!initial_pop) {
		initial_pop = true
		await render_from_location()
	}
}

if (document.readyState == 'loading')
	document.addEventListener('DOMContentLoaded', onload)
else
	onload()

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
				$main_scroll.append("instruction: "+JSON.stringify(inst))
			}
		} else {
			let type = inst.type
			if (type=='TimelineAddEntries') {
				for (let entry of inst.entries)
					add_entry(entry)
			} else if (type=='TimelinePinEntry') {
				add_entry(inst.entry)
			} else {
				$main_scroll.append("instruction: "+JSON.stringify(inst))
			}
		}
	}
}

let views = [
	// twitter.com/<name>/status/<id>
	new View(
		[true, 'status', /^\d+$/],
		function(url) {
			return auth.get_tweet(url.path[2])
		},
		function(data) {
			if (data && data.threaded_conversation_with_injections) {
				handle_instructions(data.threaded_conversation_with_injections)
			}
		}
	),
	// twitter.com/home
	new View(
		['home'],
		async function(url) {
			return auth.get_home()
		},
		function(data) {
			handle_instructions(data.timeline, data.globalObjects)
		}
	),
	// twitter.com/notifications
	new View(
		['notifications'],
		async function(url) {
			return auth.get_notifications()
		},
		function(data) {
			handle_instructions(data.timeline, data.globalObjects)
		}
	),
	// twitter.com/<name>/likes
	new View(
		[true, 'likes'],
		async function(url) {
			let username = url.path[0]
			if (username[0]=="@")
				username=username.substr(1)
			let user = await auth.get_user(username)
			if (user && user.__typename=='User') {
				let likes = await auth.get_user_likes(user.rest_id)
				return [user, likes.user.result.timeline.timeline]
			} else {
				return [user, null]
			}
		},
		function(data) {
			$main_scroll.append(draw_user(data[0]))
			if (data[1]) {
				handle_instructions(data[1])
			}
		}
	),
	// twitter.com/i/bookmarks
	new View(
		['i', 'bookmarks'],
		function(url) {
			return auth.get_bookmarks()
		},
		function(data) {
			handle_instructions(data)
		}
	),
	// twitter.com/<name>
	new View(
		[true],
		async function(url) {
			let username = url.path[0]
			if (username[0]=="@")
				username=username.substr(1)
			let user = await auth.get_user(username)
			if (user && user.__typename=='User') {
				let profile = await auth.get_profile(user.rest_id)
				return [user, profile]
			} else {
				return [user, null]
			}
		},
		function(data) {
			$main_scroll.append(draw_user(data[0]))
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
		$main_scroll.append("error rendering:\n"+e.trace)
	}
)

async function render(url) {
	console.log("beginning render of: "+url)
	url = new URL(url)
	url.path = url.pathname.substr(1).split("/")
	let view = views.find(view => view.check_path(url)) || unknown_view
	let resp
	console.log("view:",view.path)
	try {
		resp = await view.request(url)
	} catch (e) {
		console.error(e)
		view = error_view
		resp = view.request(e)
	}
	$main_scroll.replaceChildren()
	$main_scroll.scrollTop = 0
	try {
		view.render(resp)
	} catch (e) {
		console.error(e)
		view = error_view
		resp = view.request(e)
		view.render(resp)
	}
}

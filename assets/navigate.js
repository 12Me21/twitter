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
		render_from_location()
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
	constructor(check_path, request, render) {
		this.check_path = check_path
		this.request = request
		this.render = render
	}
}

// todo: we should have separate elements for like
// - the timeline you're viewing
// - a tweet you're viewing
// - maybe user profile too?
// - perhaps like, every time you navigate to a new thing, we create a new scroller, and store like, up to 3 at a time, so you can easily go back to the previous thing. sorta like tweetdeck

let views = [
	// twitter.com/<name>/status/<id>
	new View(
		url => url.path.length==3 && url.path[1]=='status' && /^\d+$/.test(url.path[2]),
		function(url) {
			return auth.get_tweet(url.path[2])
		},
		function(data) {
			if (data) {
				$main_scroll.appendChild(draw_tweet(data))
			} else {
				$main_scroll.append("tweet  no")
			}
		}
	),
	// twitter.com/<name>
	new View(
		url => url.path.length==1,
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
			if (data[1]) {
				if (data[1][0])
					$main_scroll.append(draw_tweet(data[1][0]))
				for (let tweet of data[1][1])
					$main_scroll.append(draw_tweet(tweet))
			}
		}
	),
]

let unknown_view = new View(
	url => true,
	async function(url) {
		return url
	},
	function (data) {
		$main_scroll.append("unknown page :"+data)
	}
)

let error_view = new View(
	null,
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

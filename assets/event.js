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
		elem => !!elem.dataset?.cursor,
		async function(elem) {
			let t = elem.x_timeline
			let entry = elem.closest('tl-entry') ?? elem
			
			elem.remove()
			
			let [i,o] = await t.gen.get(elem.dataset.cursor)
			
			//entry.remove() // we don't remove this because it might contain other Items
			
			t.add_instructions(i,o)
		},
	),
	new ClickAction(
		elem => elem instanceof HTMLImageElement && elem.dataset.big_src,
		async function(elem) {
			$gallery_download.href = elem.dataset.big_src
			$gallery_download.download = elem.dataset.filename
			
			$gallery_image.src = elem.src
			$gallery_image.width = elem.dataset.orig_w
			$gallery_image.height = elem.dataset.orig_w
			//$gallery_image.style.backgroundColor = elem.style.backgroundColor
			$image_viewer.hidden = false
			await blink()
			$gallery_image.src = elem.dataset.big_src
		}
	),
	new ClickAction(
		elem => elem instanceof HTMLButtonElement && elem.dataset.list_toggle,
		async function(elem) {
			let list = elem.closest('tl-list')
			let id = list.dataset.id
			
			if (elem.classList.contains('own-reaction')) {
				elem.disabled = true
				mutate.list_remove_member(id, window.list_user_hack).then(x=>{
					elem.classList.remove('own-reaction')
				}).trap(ApiError, x=>{
					console.log("list remove failed?", x)
				}).finally(x=>{
					elem.disabled = false
				})
			} else {
				elem.disabled = true
				mutate.list_add_member(id, window.list_user_hack).then(x=>{
					elem.classList.add('own-reaction')
				}).trap(ApiError, x=>{
					console.log("list add failed?", x)
				}).finally(x=>{
					elem.disabled = false
				})
			}
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
				id = tweet.dataset.rt_id ?? id
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
			} else if (type=='downvote') {
				if (elem.classList.contains('own-reaction')) {
					elem.disabled = true
					mutate.delete_downvote(id).then(x=>{
						elem.classList.remove('own-reaction')
					}).trap(ApiError, x=>{
						console.log("reaction failed?", x)
					}).finally(x=>{
						elem.disabled = false
					})
				} else {
					elem.disabled = true
					mutate.downvote(id).then(x=>{
						elem.classList.add('own-reaction')
					}).trap(ApiError, x=>{
						console.log("reaction failed?", x)
					}).finally(x=>{
						elem.disabled = false
					})
				}
			} else if (type=='bookmark') {
				id = tweet.dataset.rt_id || id // can't bookmark retweets
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

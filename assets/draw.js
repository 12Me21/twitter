function template(t) {
	let frag = t.content.cloneNode(true)
	let ids = {
		$: frag
	}
	frag.querySelectorAll("[data-id]").forEach(x=>{
		ids[x.dataset.id] = x
		delete x.dataset.id
	})
	return ids
}

// todo: use the display_text_range
function format_text(text, entities, ext, range) {
	let frag = document.createDocumentFragment()
	if (typeof text != 'string')
		return frag
	let parts = [{type:'text',start:0}]
	for (let type in entities) {
		let list = entities[type]
		if (ext && ext[type]) // idk if this is correct.
			list = ext[type]
		for (let item of list) {
			parts.push({type:type, value:item, start:item.indices[0]})
			parts.push({start:item.indices[1]})
		}
	}
	parts.sort((a,b) => a.start-b.start)
	text = [...text] // this splits the string by CODEPOINT unlike .substring which uses utf-16 characters
	for (let i=0; i<parts.length; i++) {
		let part = parts[i]
		let elem
		let {type, value} = part
		if (type=='urls') {
			elem = document.createElement('a')
			elem.textContent = value.expanded_url
			elem.href = value.expanded_url
			//make_link(elem, value.expanded_url)
		} else if (type=='hashtags') {
			elem = document.createElement('a')
			elem.textContent = "#"+value.text
		} else if (type=='media') {
			if (value.type=='photo') {
				elem = document.createElement('img')
				elem.className += ' tweet-image'
				elem.src = value.media_url_https
			} else if (value.type=='video') {
				let url = value.video_info.variants[0].url
				elem = document.createElement('video')
				elem.controls = true
				elem.preload = 'none'
				elem.poster = value.media_url_https
				elem.className += ' tweet-image'
				elem.src = url
			}
		} else if (type=='user_mentions') {
			elem = document.createElement('a')
			elem.textContent = "@"+value.screen_name
			make_link(elem, "https://twitter.com/@"+value.screen_name)
		} else if (type=='symbols') {
			elem = document.createElement('a')
			elem.textContent = value.text
		} else {
			let next = parts[i+1]
			if (next)
				next = next.start
			else
				next = text.length
			if (next > part.start) {
				let x = text.slice(part.start, next).join("")
				x = x.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
				elem = document.createTextNode(x)
			}
		}
		if (elem)
			frag.appendChild(elem)
	}
	return frag
}

function go_to(url) {
	history.pushState(null, "", url)
	render(url)
}

function link_onclick(e) {
	e.preventDefault()
	go_to(this.href)
}

function make_link(link, url) {
	link.href = url
	link.onclick = link_onclick
}

function format_date(date) {
	var seconds = Math.floor((Date.now() - date.getTime()) / 1000)
	var interval = Math.floor(seconds / 31536000)
	if (interval >= 1) return interval + " years ago"
	interval = Math.round(seconds / 2592000)
	if (interval >= 1) return interval + " months ago"
	interval = Math.round(seconds / 86400)
	if (interval >= 1) return interval + " days ago"
	interval = Math.round(seconds / 3600)
	if (interval >= 1) return interval + " hours ago"
	interval = Math.round(seconds / 60)
	if (interval >= 1) return interval + " minutes ago"
	return "Just now"
	/*if (seconds <= -0.5)
	  return " IN THE FUTURE?"
	  return Math.round(seconds) + " seconds ago"*/
}

// todo: reverse the search I guess, since most items get inserted at the bottom
function add_entry(entry, objects) {
	if (/promotedTweet-/y.test(entry.entryId))
		return
	let elem = draw_entry(entry, objects)
	let after = null
	for (let child of $main_scroll.children) {
		if (child.dataset.order < elem.dataset.order) {
			after = child
			break
		}
	}
	$main_scroll.insertBefore(elem, after)
}

function draw_cursor(cursor) {
	let elem = document.createElement('div')
	elem.textContent = JSON.stringify(cursor)
	return elem
}

function draw_notification(notif) {
	let elem = document.createElement('div')
	elem.textContent = notif.message.text
	return elem
}

// an 'item' is a single tweet, or other widget, that appears in the timeline
function draw_item(item, objects) {
	if (objects) {
		let content = item.content
		if (content.tweet) {
			return draw_tweet(content.tweet.id, objects)
		} else if (content.notification) {
			return draw_notification(objects.notifications[content.notification.id])
		}
		return document.createTextNode("item: "+JSON.stringify(content))
	} else {
		let content = item.itemContent
		let type = content.itemType
		
		if (type=='TimelineTweet') {
			let result = content.tweet_results.result
			let objects = {tweets:{}, users:{}}
			let id = tweet_to_v2(content.tweet_results.result, objects)
			return draw_tweet(id, objects)
		} else if (type=='TimelineTimelineCursor') {
			return draw_cursor(content)
		} else {
			return document.createTextNode("item: "+type)
		}
	}
}

// an 'entry' contains 0 or more 'items', grouped together
function draw_entry(entry, objects) {
	let elem = document.createElement('div')
	elem.className = "entry"
	elem.dataset.order = entry.sortIndex
	let content = entry.content
	
	if (objects) { //new format
		if (content.timelineModule) {
			for (let item of content.timelineModule.items)
				elem.append(draw_item(item.item, objects))
		} else if (content.item) {
			elem.append(draw_item(content.item, objects))
		} else if (content.operation) {
			if (content.operation.cursor) {
				elem.append(draw_cursor(content.operation.cursor))
			} else
				elem.textContent = "entry "+JSON.stringify(content)
		} else {
			elem.textContent = "entry "+JSON.stringify(content)
		}
	} else { //old format
		let type = content.entryType
		if (type=='TimelineTimelineItem') {
			elem.append(draw_item(content))
		} else if (type=='TimelineTimelineModule') {
			for (let item of content.items)
				elem.append(draw_item(item.item))
		} else if (type=='TimelineTimelineCursor') {
			elem.textContent = "cursor entry "+JSON.stringify(content)
		} else {
			elem.textContent = "entry "+JSON.stringify(content)
		}
	}
	return elem
}

function tweet_to_v2(result, objects) {
	if (!result) // this can happen when a user's pinned tweet has been deleted
		return null
	objects.tweets[result.legacy.id_str] = result.legacy
	if (result.legacy.retweeted_status_result) {
		result.legacy.retweeted_status_id_str = tweet_to_v2(result.legacy.retweeted_status_result.result, objects)
		delete result.legacy.retweeted_status_result
	}
	result.legacy.ext = {
		signalsReactionMetadata: { r: { ok: {
			reactionTypeMap: result.reactionMetadata.reactionTypeMap.map(x=>[x.type,x.count])
		}}},
		signalsReactionPerspective: { r: {
			ok: result.reactionPerspective
		}},
	}
	let user = result.core.user_results.result
	objects.users[user.rest_id] = user.legacy
	if (result.quoted_status_result) {
		tweet_to_v2(result.quoted_status_result.result, objects)
	}
	return result.legacy.id_str
}

function draw_names(user) {
	let ids = template($Usernames)
	ids.name.textContent = user.name
	ids.username.textContent = "@"+user.screen_name
	let profile = "https://twitter.com/@"+user.screen_name
	make_link(ids.name_link, profile)
	make_link(ids.username_link, profile)
	return ids.$
}

function draw_reaction(icon, count, pressed) {
	let r = template($ReactButton)
	r.icon.textContent = icon
	if (count>0)
		r.count.textContent = count
	if (pressed)
		r.main.className += ' own-reaction'
	return r.main	
}

// idea: maybe put like/rt/reply count under avtaar?
function draw_tweet(id, objects) {
	try {
		let tweet = objects.tweets[id]
		if (!tweet) {
			return template($MissingTweet).main
		}
		let ids = template($Tweet)
		
		// if this is a retweet, replace it with the original tweet and add a note
		if (tweet.retweeted_status_id_str) {
			let retweeter = objects.users[tweet.user_id_str]
			tweet = objects.tweets[tweet.retweeted_status_id_str]
			ids.retweeted_by.append("Retweeted by ")
			ids.retweeted_by.append(draw_names(retweeter))
		} else {
			ids.retweeted_by.remove()
		}
		
		let user = objects.users[tweet.user_id_str]
		
		ids.time.textContent = format_date(new Date(tweet.created_at))
		// user stuff
		let username = "missingno" // fallback
		username = user.screen_name
		ids.avatar.src = user.profile_image_url_https.replace("_normal", "_bigger")
		make_link(ids.avatar_link, "https://twitter.com/@"+user.screen_name)
		ids.user_names.replaceWith(draw_names(user))
		
		make_link(ids.tweet_link, `https://twitter.com/@${username}/status/${tweet.id_str}`)
		
		// [translate] button
		/*let tc = ids.translated_contents
		ids.translate_button.onclick = async function() {
			let json = await auth.translate_tweet(tweet.id_str)
			tc.replaceChildren(format_text(json.translation, json.entities))
		}*/
		
		ids.contents.replaceChildren(format_text(tweet.full_text, tweet.entities, tweet.extended_entities, tweet.display_text_range))
		// if this is a quote retweet, render the quoted tweet
		if (tweet.quoted_status_id_str) {
			ids.contents.appendChild(draw_tweet(tweet.quoted_status_id_str, objects))
		}
		// regular interaction counts
		ids.likes.textContent = tweet.favorite_count
		let x = document.createDocumentFragment()
		x.append(draw_reaction("🔁", tweet.retweet_count))
		x.append(draw_reaction("qrt", tweet.quote_count))
		x.append(draw_reaction("reply", tweet.reply_count))
		
		// draw reactions (secret)
		if (tweet.ext && tweet.ext.signalsReactionMetadata) {
			if (!auth.guest) {
				let mine = tweet.ext.signalsReactionPerspective.r.ok.reactionType
				for (let react of tweet.ext.signalsReactionMetadata.r.ok.reactionTypeMap) {
					let icon = {
						Cheer: "🎉",
						Like: "👍",
						Sad: "😢",
						Haha: "(lol)", // can't find a decent icon that stands out. these probably need to be color coded so it's easier to tell the faces apart.
						Hmm: "🤔"
					}[react[0]]
					x.append(draw_reaction(icon, react[1], react[0]==mine))
				}
			}
		}
		ids.reactions.replaceWith(x)
		// todo: gear icon should display a list of like
		// pin, bookmark, delete, etc.
		
		return ids.main
	} catch (e) {
		console.error("error drawing tweet", e)
		return template($MissingTweet).main
	}
}

function draw_profile(result) {
	if (result && result.__typename=='User') {
		let ids = template($Profile)
		let user = result.legacy
		
		if (user.profile_banner_url) {
			ids.banner.src = user.profile_banner_url+"/1500x500"
		} else {
			ids.banner.hidden = true
		}
		
		ids.avatar.src = user.profile_image_url_https.replace('_normal', '')
		ids.names.replaceWith(draw_names(user))
		ids.bio.append(format_text(user.description, user.entities.description))
		ids.website.append(format_text(user.url, user.entities.url))
		ids.location.textContent = user.location
		ids.joined.textContent = format_date(new Date(user.created_at))
		
		ids.follower_count.textContent = user.normal_followers_count
		ids.tweet_count.textContent = user.statuses_count
		
		return ids.main
	} else if (result && result.__typename=='UserUnavailable') {
		return document.createTextNode("user unavailalbe: "+result.reason)
	} else {
		return document.createTextNode("user ?? " + JSON.stringify(result))
	}
}

// profile banner
// profile picture
// username, display name
// bio text

// location
// website
// join date
// birthdate

// followers count
// following count
// profile color ?
// controls for following etc.

// tweets
// tweets + replies
// likes
// (some way to filter retweets out)
// media?
// followers
// following

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

function draw_link(url, text) {
	let elem = document.createElement('a')
	elem.className = 'pre'
	elem.textContent = text
	make_link(elem, url)
	return elem
}

//todo: maybe replace encodeURIComponent with something that makes the url more readable (i.e. don't encode :, replace spaces with +, etc)
function search_url(query) {
	return "https://twitter.com/search?q="+encodeURIComponent(query)
}

// todo: use the display_text_range
function format_text(text, entities, ext, range, tweet, user) {
	let frag = document.createDocumentFragment()
	if (typeof text != 'string')
		return frag
	let parts = [{start:0}]
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
	let media = []
	for (let i=0; i<parts.length; i++) {
		let part = parts[i]
		let elem
		let {type, value} = part
		if (type=='urls') {
			elem = document.createElement('a')
			elem.className = 'pre'
			elem.href = value.expanded_url
			elem.textContent = value.expanded_url.replace(/^https?:\/\//, "")
			//make_link(elem, value.expanded_url)
		} else if (type=='hashtags') {
			elem = draw_link(search_url("#"+value.text), "#"+value.text)
		} else if (type=='media') {
			if (value.type=='photo') {
				let name = `@${user.screen_name}-${tweet.id_str}-${media.length}`
				media.push(draw_image(value, name))
			} else if (value.type=='video') {
				media.push(draw_video(value.video_info.variants[0].url, value.media_url_https))
			}
		} else if (type=='user_mentions') {
			elem = draw_link("https://twitter.com/"+value.screen_name, "@"+value.screen_name)
		} else if (type=='symbols') { // "cashtag"
			elem = draw_link(search_url("$"+value.text), "$"+value.text)
		} else {
			if (type!==undefined) {
				console.log('unknown entity:', value)
			}
			let next = parts[i+1]
			if (next)
				next = next.start
			else
				next = text.length
			if (next > part.start) {
				let x = text.slice(part.start, next).join("")
				x = x.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
				elem = document.createElement('span')
				elem.className = 'pre'
				elem.textContent = x
			}
		}
		if (elem)
			frag.append(elem)
	}
	if (media.length) {
		let div = document.createElement('media-box')
		for (let elem of media)
			div.append(elem)
		frag.append(div)
	}
	return frag
}

async function download_link_onclick(e) {
	e.preventDefault()
	let link = e.target
	let url = link.href
	link.disabled = true
	// download file and create object url
	let blob = await fetch(url).then(x=>x.blob())
	link.href = URL.createObjectURL(blob)
	// click the link to save the file
	link.disabled = false
	link.onclick = null
	link.click()
	// free the object url and revert the link
	URL.revokeObjectURL(link.href)
	link.href = url
	link.onclick = download_link_onclick
}

function draw_image(media, name) {
	let url = media.media_url_https
	let {'1': base, '2': ext} = url.match(/^(.*)\.(.*?)$/)
	let ids = template($MediaPicture)
	ids.image.src = url
	ids.image.alt = media.ext_alt_text
	ids.link.href = `${base}?format=${ext}&name=orig`
	ids.link.download = name+"."+ext
	ids.link.onclick = download_link_onclick
	let col = media.ext_media_color.palette[0].rgb
	ids.image.style.backgroundColor = `rgb(${col.red},${col.green},${col.blue})`
	return ids.main
}

function draw_video(url, thumbnail) {
	let elem = document.createElement('video')
	elem.controls = true
	elem.preload = 'none'
	elem.poster = thumbnail
	elem.src = url
	return elem
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
	if (!elem)
		return
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

// cards are used for website previews etc. but ALSO for polls
function draw_card() {
/*	1434712597232640003: {created_at: "Mon Sep 06 02:58:33 +0000 2021", id: 1434712597232640000, id_str: "1434712597232640003",…}
card: {name: "poll2choice_text_only", url: "card://1434712596393852930",…}
binding_values: {choice1_label: {type: "STRING", string_value: "0"},…}
card_platform: {platform: {device: {name: "Swift", version: "12"}, audience: {name: "production", bucket: null}}}
card_type_url: "http://card-type-url-is-deprecated.invalid"
name: "poll2choice_text_only"
url: "card://1434712596393852930"
contributors: null*/

}

// an 'item' is a single tweet, or other widget, that appears in the timeline
function draw_item(item, objects) {
	if (objects) {
		let content = item.content
		if (content.tweet) {
			if (content.tweet.promotedMetadata)
				return null
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
		} else if (type=='TimelineTwitterList') {
			return draw_list(content.list)
		} else if (type=='TimelineUser') {
			return null
			//console.log(content)
			//return draw_user(content.user_results.result.legacy)
		} else if (type=='TimelineTopic') {
			return null
		}
		return document.createTextNode("item: "+JSON.stringify(content))
	}
}

function draw_list(data) {
	let ids = template($List)
	ids.title.textContent = data.name
	make_link(ids.title, "https://twitter.com/i/lists/"+data.id_str)
	ids.names.append(draw_names(data.user_results.result.legacy))
	ids.icon.style.backgroundImage = "url("+data.default_banner_media.media_info.original_img_url+")" // todo: use the smallened url
	return ids.main
}

// an 'entry' contains 0 or more 'items', grouped together
function draw_entry(entry, objects) {
	let elem = document.createElement('tl-entry')
	elem.className
	elem.dataset.order = entry.sortIndex
	let content = entry.content
	
	if (objects) { //new format
		if (content.timelineModule) {
			for (let item of content.timelineModule.items) {
				let x = draw_item(item.item, objects)
				if (x)
					elem.append(x)
			}
		} else if (content.item) {
			let x = draw_item(content.item, objects)
			if (x)
				elem.append(x)
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
			let x = draw_item(content)
			if (x)
				elem.append(x)
		} else if (type=='TimelineTimelineModule') {
			for (let item of content.items) {
				let x = draw_item(item.item)
				if (x)
					elem.append(x)
			}
		} else if (type=='TimelineTimelineCursor') {
			elem.textContent = "cursor entry "+JSON.stringify(content)
		} else {
			elem.textContent = "entry "+JSON.stringify(content)
		}
	}
	if (elem.childNodes.length==0)
		return null
	return elem
}

// todo: error checking here
function tweet_to_v2(result, objects) {
	if (!result) // this can happen when a user's pinned tweet has been deleted
		return null
	objects.tweets[result.legacy.id_str] = result.legacy
	if (result.legacy.retweeted_status_result) {
		result.legacy.retweeted_status_id_str = tweet_to_v2(result.legacy.retweeted_status_result.result, objects)
		delete result.legacy.retweeted_status_result
	}
	if (result.reactionMetadata) {
		result.legacy.ext = {
			signalsReactionMetadata: { r: { ok: {
				reactionTypeMap: result.reactionMetadata.reactionTypeMap.map(x=>[x.type,x.count])
			}}},
			signalsReactionPerspective: { r: {
				ok: result.reactionPerspective
			}},
		}
	}
	if (result.quoted_status_result) {
		tweet_to_v2(result.quoted_status_result.result, objects)
	}
	if (result.card) {
		result.legacy.card = result.card.legacy
		let map = {}
		for (x of result.card.legacy.binding_values) {
			map[x.key] = x.value
		}
		result.legacy.card.binding_values = map
	}
	
	let user = result.core.user_results.result
	objects.users[user.rest_id] = user.legacy

	return result.legacy.id_str
}

function draw_card(card) {
	console.log(card)
	if (/^poll\d+choice_text_only$/.test(card.name)) {
		let ids = template($Poll)
		let choices = Number(card.name.match(/^poll(\d+)choice_text_only$/)[1])
		let options = []
		let total = 0
		for (let i=0; i<choices; i++) {
			options[i] = [
				card.binding_values[`choice${i+1}_label`].string_value,
				Number(card.binding_values[`choice${i+1}_count`].string_value)
			]
			total += options[i][1]
		}
		for (let [label, count] of options) {
			let ids2 = template($PollChoice)
			ids2.count.textContent = count
			ids2.label.textContent = label
			ids2.visual.style.width = (count/total*100)+"%"
			ids.main.append(ids2.main)
		}
		return ids.main
	} else {
		let x = document.createElement('div')
		x.textContent = JSON.stringify(card)
		return x
	}
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

function draw_user(user) {
	let ids = template($TimelineUser)
	ids.names.replaceWith(draw_names(user))
	ids.bio.append(format_text(user.description, user.entities.description, null, null, null, user))
	ids.avatar.src = user.profile_image_url_https
	let col = user.profile_image_extensions.mediaColor.r.ok.palette[0].rgb
	ids.avatar.style.backgroundColor = `rgb(${col.red},${col.green},${col.blue})`
	make_link(ids.avatar_link, "https://twitter.com/@"+user.screen_name)
	return ids.main
}

//function draw_avatar
// fill_image_bg -- from palette

// idea: maybe put like/rt/reply count under avtaar?
function draw_tweet(id, objects) {
	try {
		let tweet = objects.tweets[id]
		if (!tweet) {
			return template($MissingTweet).main
		}
		let ids = template($Tweet)
		
		ids.main.dataset.id = tweet.id_str
		// if this is a retweet, replace it with the original tweet and add a note
		if (tweet.retweeted_status_id_str) {
			let retweeter = objects.users[tweet.user_id_str]
			tweet = objects.tweets[tweet.retweeted_status_id_str]
			ids.note.append("Retweeted by ")
			ids.note.append(draw_names(retweeter))
		} else {
			ids.note.remove()
		}
		
		if (tweet.in_reply_to_status_id_str) {
			ids.reply_label.textContent = "R"
		}
		
		let user = objects.users[tweet.user_id_str]
		
		ids.time.textContent = format_date(new Date(tweet.created_at))
		// user stuff
		let username = "missingno" // fallback
		username = user.screen_name
		ids.avatar.src = user.profile_image_url_https.replace("_normal", "_bigger")
		//let col = user.profile_image_extensions.mediaColor.r.ok.palette[0].rgb
		//ids.avatar.style.backgroundColor = `rgb(${col.red},${col.green},${col.blue})`
		make_link(ids.avatar_link, "https://twitter.com/@"+user.screen_name)
		ids.user_names.replaceWith(draw_names(user))
		
		make_link(ids.tweet_link, `https://twitter.com/@${username}/status/${tweet.id_str}`)
		
		// [translate] button
		/*let tc = ids.translated_contents
		ids.translate_button.onclick = async function() {
			let json = await auth.translate_tweet(tweet.id_str)
			tc.replaceChildren(format_text(json.translation, json.entities))
		}*/
		
		ids.contents.replaceChildren(format_text(tweet.full_text, tweet.entities, tweet.extended_entities, tweet.display_text_range, tweet, user))
		// if this is a quote retweet, render the quoted tweet
		if (tweet.quoted_status_id_str) {
			ids.contents.append(draw_tweet(tweet.quoted_status_id_str, objects))
		}
		// regular interaction counts
		let x = document.createDocumentFragment()
		x.append(draw_reaction("🔁", tweet.retweet_count))
		x.append(draw_reaction("qrt", tweet.quote_count))
		x.append(draw_reaction("reply", tweet.reply_count))
		x.append(draw_reaction("💙", tweet.favorite_count))
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
		
		if (tweet.card) {
			let card = draw_card(tweet.card)
			ids.contents.append(card)
		}
		
		return ids.main
	} catch (e) {
		console.error("error drawing tweet", e)
		return template($MissingTweet).main
	}
}

function draw_profile(user) {
	console.log(user)
	if (user) {
		let ids = template($Profile)
		
		if (user.profile_banner_url) {
			ids.banner.src = user.profile_banner_url+"/1500x500"
		} else {
			ids.banner.hidden = true
		}
		
		ids.avatar.src = user.profile_image_url_https.replace('_normal', '')
		ids.names.replaceWith(draw_names(user))
		ids.bio.append(format_text(user.description, user.entities.description, null, null, null, user))
		ids.website.append(format_text(user.url, user.entities.url, null, null, null, user))
		ids.location.textContent = user.location
		ids.joined.textContent = format_date(new Date(user.created_at))
		
		ids.follower_count.textContent = user.normal_followers_count
		ids.tweet_count.textContent = user.statuses_count
		
		ids.bar.style.backgroundColor = "#"+user.profile_link_color
		
		return ids.main
	//} else if (result && result.__typename=='UserUnavailable') {
	//	return document.createTextNode("user unavailalbe: "+result.reason)
	} else {
		return document.createTextNode("user ?? " + JSON.stringify(result))
	}
}

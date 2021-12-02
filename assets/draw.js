// return Object map: String -> Node
function template(
	t // HTMLTemplateElement
) {
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

// return String
function profile_url(
	username // String (twitter username)
) {
	// prepend @ if the name collides with another page
	if (/^(login|logout|home|i|compose|notifications|search|account)$/.test(username))
		username = "@"+username
	return "https://twitter.com/"+username
}

// return String
function unescape_html(
	text // String
) {
	return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&amp;/g, "&")
}

// return Node
function draw_link(
	url, // String
	text // String
) {
	let elem = document.createElement('a')
	elem.className = 'pre'
	elem.textContent = text
	make_link(elem, url)
	return elem
}

const MAX_BITRATE = 2000000

// return Node
function draw_media(
	value,
	name
) {
	if (value.type=='photo') {
		return draw_image(value, name)
	} else if (value.type=='video') {
		// todo: find the right variant
		//console.log("videos", value.video_info.variants)
		let vs = value.video_info.variants.filter(x=>x.bitrate).sort((a,b)=> {
			let aa = a.bitrate
			let bb = b.bitrate
			if (bb > MAX_BITRATE)
				bb = -bb
			if (aa > MAX_BITRATE)
				aa = -aa
			return bb-aa
		})
		let ids = template($MediaVideo)
		ids.image.preload = value.media_url_https
		for (let v of vs) {
			let s = document.createElement('source')
			s.type = v.content_type
			s.src = v.url
			ids.image.append(s)
		}
		return ids.main
	} else if (value.type=='animated_gif') {
		return draw_video(value.video_info.variants[0].url, )
	} else {
		return document.createTextNode("unknown media type: "+JSON.stringify(value))
	}
}

function search_url(query) {
	return "https://twitter.com/search?q="+encodeURIComponent(query)
}

// Apply formatting to text
// this is used for adding links, images, etc. to tweet text (as well as
// return: 
// if `separate_media` - [DocumentFragment, Node]
// else - DocumentFragment
function format_text(
	text, // raw text
	entities, // tweet entities table
	ext, // (optional) tweet extended entities table
	range, // (optional) display_text_range (TODO)
	// these fields are purely used for determining image filenames:	
	tweet,
	user,
	// if true, return just a single docfrag instead of separate media
	separate_media
) {
	let frag = document.createDocumentFragment()
	if (typeof text != 'string')
		return frag
	let parts = [{start:0}]
	for (let type in entities) {
		let list = entities[type]
		if (ext && ext[type]) // idk if this is correct.
			list = ext[type]
		for (let item of list) {
			parts.push({type:type, value:item, start:item.indices[0]}) // formatted part
			parts.push({start:item.indices[1]}) // the following plaintext part
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
			let url = String(value.expanded_url ?? value.url)
			elem.href = url
			elem.textContent = url.replace(/^https?:\/\//, "")
			elem.target = '_blank'
			//make_link(elem, value.expanded_url)
		} else if (type=='hashtags') {
			elem = draw_link(search_url("#"+value.text), "#"+value.text)
		} else if (type=='media') {
			let name = `@${user.screen_name}-${tweet.id_str}-${media.length}`
			media.push(draw_media(value, name))
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
				x = unescape_html(x)
				elem = document.createElement('span')
				elem.className = 'pre'
				elem.textContent = x
			}
		}
		if (elem)
			frag.append(elem)
	}
	let div = null
	if (media.length) {
		div = document.createElement('media-box')
		for (let elem of media)
			div.append(elem)
		if (!separate_media)
			frag.append(div)
	}
	if (separate_media)
		return [frag, div]
	return frag
}

async function download_link_onclick(e) {
	console.log('download')
	e.preventDefault()
	let link = e.target
	let url = link.href
	if (!url)
		return
	link.disabled = true
	// download file and create object url
	let blob = await fetch(url).then(x=>x.blob())
	link.href = URL.createObjectURL(blob)
	// click the link to save the file
	link.disabled = false
	link.onclick = null
	link.click()
	// free the object url and revert the link
	window.setTimeout(()=>{
		URL.revokeObjectURL(link.href)
		link.href = url
		link.onclick = download_link_onclick
	},0)
}

function draw_image(media, name) {
	let url = media.media_url_https
	let {'1': base, '2': ext} = url.match(/^(.*)\.(.*?)$/)
	let ids = template($MediaPicture)
	ids.image.src = `${base}?format=${ext}&name=small`
	if (media.ext_alt_text != undefined) {
		ids.image.title = ids.image.alt = media.ext_alt_text
	}
	ids.image.width = media.sizes.small.w
	ids.image.height = media.sizes.small.h
	
	ids.image.dataset.big_src = `${base}?format=${ext}&name=orig`
	ids.image.dataset.orig_w = media.original_info.width
	ids.image.dataset.orig_h = media.original_info.height
	ids.image.dataset.filename = name
	
	if (media.ext_media_color) {
		let col = media.ext_media_color.palette[0].rgb
		ids.image.style.backgroundColor = `rgb(${col.red},${col.green},${col.blue})`
	}
	
	return ids.main
}

/*function pick_size(media) {
	let sizes = [
		['tiny', 64],
		['120x120', 120],
		['240x240', 240],
		['360x360', 360],
		['900x900', 900],
	]
	for (let size of sizes) {
		size[2] = size[1]
	}
	for (let size in media.sizes) {
		let info = media.sizes[size]
		if (info.resize=='fit')
			sizes.push(size, )
	}	
}*/

function draw_video(url, thumbnail) {
	let ids = template($MediaVideo)
	ids.image.src = url
	ids.image.preload = thumbnail
	ids.image.onerror = function() {
		console.log("video failed!", this);
		//this.load()
	}
	return ids.main
}

function link_onclick(e) {
	e.preventDefault()
	go_to(this.href)
}

function make_link(link, url) {
	link.href = url
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

function draw_notification(notif, objects) {
	let elem = document.createElement('div')
	elem.textContent = notif.message.text
	let tweets = notif.template?.aggregateUserActionsV1?.targetObjects
	if (tweets) {
		for (let x of tweets) {
			if (x.tweet) {
				let id = x.tweet.id
				elem.append(draw_tweet(id, objects))
			}
		}
	}
	return elem
}

function draw_list(data) {
	let ids = template($List)
	ids.title.textContent = data.name
	make_link(ids.title, "https://twitter.com/i/lists/"+data.id_str)
	ids.names.append(draw_names(data.user_results.result.legacy))
	ids.icon.style.backgroundImage = "url("+data.default_banner_media.media_info.original_img_url+")" // todo: use the smallened url
	return ids.main
}

// cards are used for website previews etc. but ALSO for polls
function draw_card(card) {
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
	} else if (card.name=='summary_large_image'||card.name=='summary') {
		let ids = template($SummaryCard)
		ids.title.textContent = card.binding_values.title.string_value
		if (card.binding_values.description)
			ids.desc.textContent = card.binding_values.description.string_value
		if (card.binding_values.thumbnail_image) {
			ids.image.src = card.binding_values.thumbnail_image.image_value.url // todo - remember that this gives us info about the image size
		} else {
			ids.image.remove()
		}
		return ids.main
	} else if (card.name=='player') {
		let ids = template($SummaryCard)
		ids.title.textContent = card.binding_values.title.string_value
		if (card.binding_values.description)
			ids.desc.textContent = card.binding_values.description.string_value
		ids.image.src = card.binding_values.player_image.image_value.url // todo
		return ids.main
	} else {
		return draw_unknown("Unknown Card Type: "+card.name, card)
	}
}

function draw_unknown(title, data) {
	let ids = template($Unknown)
	ids.label.textContent = title
	ids.data.textContent = JSON.stringify(data)
	return ids.main
}

// `user` twitter_user -
// `return` DocumentFragment -
function draw_names(user) {
	let ids = template($Usernames)
	ids.name.textContent = unescape_html(user.name)
	ids.username.textContent = "@"+user.screen_name
	if (user.verified)
		ids.badges.append(template($Icon_verified).$)
	if (user.protected)
		ids.badges.append(template($Icon_protected).$)
	// todo: better css so we don't need to...
	if (ids.badges.children.length == 0)
		ids.badges.remove()
	//let profile = profile_url(user.screen_name)
	/*if (!no_link) {
		make_link(ids.name_link, profile)
		make_link(ids.username_link, profile)
	}*/
	return ids.$
}

// return Node
function draw_reaction(
	icon, // Node
	type, // String
	count, // Number
	pressed // Boolean
) {
	let r = template($ReactButton)
	r.icon.append(icon)
	if (count != undefined) {
		if (count>0)
			r.count.textContent = count
	}
	if (pressed)
		r.main.className += ' own-reaction'
	r.main.dataset.interact = type
	r.main.dataset.click = ""
	return r.main	
}

// return Node
function draw_user(
	user // twitter user
) {
	let ids = template($TimelineUser)
	ids.names.replaceWith(draw_names(user))
	ids.bio.append(format_text(user.description, user.entities.description, null, null, null, user))
	ids.avatar.src = user.profile_image_url_https
	let col = user.profile_image_extensions.mediaColor.r.ok.palette[0].rgb
	ids.avatar.style.backgroundColor = `rgb(${col.red},${col.green},${col.blue})`
	make_link(ids.avatar_link, profile_url(user.screen_name))
	return ids.main
}

//function draw_avatar
// fill_image_bg -- from palette

// idea: maybe put like/rt/reply count under avtaar?

// return Node
function draw_tweet(
	id, // String (numeric)
	objects, // object map: numericstring -> tweet
	sc, // twitter socialContext object (optional)
) {
	let notes = []
	if (sc) {
		if (sc.generalContext) {
			let gc = sc.generalContext
			let icon = {
				Conversation: $Icon_reply,
				Like: $Icon_like,
			}[gc.contextType]
			let x = document.createDocumentFragment()
			if (icon)
				x.append(template(icon).$)
			x.append(gc.text)
			notes.push(x)
		}
		if (sc.topicContext) {
			let t = objects.topics[sc.topicContext.topicId]
			if (t)
				notes.push("Topic: "+t.name)
		}
	}
	
	let tweet = objects.tweets[id]
	if (!tweet) {
		return template($MissingTweet).main
	}
	let ids = template($Tweet)
	
	ids.main.dataset.id = tweet.id_str
	// if this is a retweet, replace it with the original tweet and add a note
	if (tweet.retweeted_status_id_str) {
		let retweeter = objects.users[tweet.user_id_str]
		
		let x = template($NoteRetweeted)
		x.names.replaceWith(draw_names(retweeter))
		x.time.textContent = format_date(new Date(tweet.created_at))
		notes.push(x.$)
		
		tweet = objects.tweets[tweet.retweeted_status_id_str]
		ids.main.dataset.rt_id = tweet.id_str
	}
	
	if (notes.length) {
		for (let x of notes) {
			let n = template($TweetNote).main
			n.append(x)
			ids.note.append(n)
		}
	} else
		ids.note.remove()
	
	if (tweet.in_reply_to_status_id_str) {
		ids.reply_label.textContent = "R"
	}
	
	let user = objects.users[tweet.user_id_str]
	
	ids.time.textContent = format_date(new Date(tweet.created_at))
	// user stuff
	let username = "missingno" // fallback
	username = user.screen_name
	ids.avatar.src = user.profile_image_url_https.replace("_normal", "_bigger")
	if (user.ext_has_nft_avatar)
		ids.avatar.classList.add('nft-avatar')
	//let col = user.profile_image_extensions.mediaColor.r.ok.palette[0].rgb
	//ids.avatar.style.backgroundColor = `rgb(${col.red},${col.green},${col.blue})`
	make_link(ids.user_link, profile_url(user.screen_name))
	ids.user_names.replaceWith(draw_names(user))
	
	make_link(ids.tweet_link, profile_url(user.screen_name)+`/status/${tweet.id_str}`)
	
	// [translate] button
	if (tweet.lang!='en' && tweet.lang!='und') { // todo: check user's native lang
		let tc = ids.translated_contents
		ids.translate_button.onclick = async function() {
			let json = await query.translate_tweet(tweet.id_str)
			if (json) {
				tc.replaceChildren(format_text(json.translation, json.entities))
			}
		}
	} else {
		ids.translate_button.remove()
		ids.translated_contents.remove()
	}
	
	let [content, media] = format_text(tweet.full_text, tweet.entities, tweet.extended_entities, tweet.display_text_range, tweet, user, true)
	
	ids.contents.replaceChildren(content)
	// this happens if the tweet only contains images
	if (ids.contents.childNodes.length==0)
		ids.contents.remove()
	
	if (media)
		ids.media.replaceWith(media)
	else
		ids.media.remove()
	
	// if this is a quote retweet, render the quoted tweet
	if (tweet.quoted_status_id_str) {
		ids.quote.replaceWith(draw_tweet(tweet.quoted_status_id_str, objects))
	} else
		ids.quote.remove()
	
	// draw card
	if (tweet.card) {
		let card = draw_card(tweet.card)
		ids.contents.append(card)
	}
	
	// regular interaction counts 
	let x = document.createDocumentFragment()
	x.append(draw_reaction(template($Icon_reply).$, 'reply', tweet.reply_count))
	x.append(draw_reaction(template($Icon_quote).$, 'quote', tweet.quote_count))
	x.append(draw_reaction(template($Icon_retweet).$, 'retweet', tweet.retweet_count, tweet.retweeted))
	x.append(draw_reaction(template($Icon_like).$, 'like', tweet.favorite_count, tweet.favorited))
	x.append(draw_reaction(template($Icon_downvote).$, 'downvote', null, tweet.ext?.downvotePerspective?.isDownvoted))
	x.append(draw_reaction(template($Icon_bookmark).$, 'bookmark', undefined))
	
	
	// draw reactions (secret)
	/*if (tweet.ext && tweet.ext.signalsReactionMetadata) {
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
				x.append(draw_reaction(icon, react[0], react[1], react[0]==mine))
			}
		}
	}*/
	
	ids.reactions.replaceWith(x)
	// todo: gear icon should display a list of like
	// pin, delete, etc.
	
	return ids.main
}

// return Node
function draw_profile(
	user, // twitter user
	extra
) {
	if (!user) {
		return draw_unknown("Invalid User", result)
	}
	
	let ids = template($Profile)
	
	if (user.profile_banner_url) {
		ids.banner.src = user.profile_banner_url+"/1500x500"
		ids.banner.dataset.big_src = user.profile_banner_url+"/1500x500"
		ids.banner.dataset.filename = `@${user.screen_name}-banner`
	} else {
		ids.banner.hidden = true
	}
	
	ids.avatar.src = user.profile_image_url_https.replace('_normal', '')
	ids.avatar.dataset.big_src = ids.avatar.src
	ids.avatar.dataset.filename = `@${user.screen_name}-avatar`
	
	ids.names.replaceWith(draw_names(user))
	ids.bio.append(format_text(user.description, user.entities.description, null, null, null, user))
	if (user.url)
		ids.website.append(format_text(user.url, user.entities.url, null, null, null, user))
	else 
		ids.website.parentNode.remove()
	if (user.location)
		ids.location.textContent = user.location
	else
		ids.location.parentNode.remove()
	ids.joined.textContent = format_date(new Date(user.created_at))
	//console.log('draw profile', user)
	ids.follower_count.textContent = user.normal_followers_count
	ids.tweet_count.textContent = user.statuses_count
	
	ids.follow_button.textContent = ["not following", "following"][user.following?1:0]//[["not following", "follows you"],["following", "mutual"]][user.following?1:0][user.followed_by?1:0]
	if (user.followed_by)
		ids.follow_note.textContent = "follows you"
	if (user._friends) {
		// todo: make thsi better
		let text = "also followed by "+user._friends.map(x=>"@"+x.screen_name).join(", ")
		ids.friends.textContent = text
	}
	
	if (user.profile_link_color!='1DA1F2') {
		ids.bar.style.backgroundColor = "#"+user.profile_link_color
	} else {
		ids.bar.remove()
	}
	
	if (user.ext_has_nft_avatar)
		ids.avatar.classList.add('nft-avatar')
	
	// todo: this is used for like, newsletters
	if (user._biz) {
		for (let x of user._biz.profilemodules.v1) {
			
		}
	}
	
	let base = "https://twitter.com/"+user.screen_name
	ids.tab_tweets.href = base
	ids.tab_replies.href = base+"/with_replies"
	ids.tab_media.href = base+"/media"
	ids.tab_likes.href = base+"/likes"
	ids.tab_followers.href = base+"/followers"
	ids.tab_following.href = base+"/following"
	ids.tab_lists.href = base+"/lists"
	
	return ids.main
	//} else if (result && result.__typename=='UserUnavailable') {
	//	return document.createTextNode("user unavailalbe: "+result.reason)
}

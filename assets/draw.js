function template(t) {
	let ids = {}
	t.content.cloneNode(true).querySelectorAll("[data-id]").forEach(x=>{
		ids[x.dataset.id] = x
		delete x.dataset.id
	})
	return ids
}

// todo: extended_entities (i.e. videos)
function format_text(text, entities, ext) {
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
		let part = parts[i];
		let elem;
		let {type, value} = part;
		if (type=='urls') {
			elem = document.createElement('a')
			elem.textContent = value.expanded_url
			elem.href = value.expanded_url
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
			elem.href = "https://twitter.com/@"+value.screen_name
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

function link_onclick(e) {
	e.preventDefault()
	let url = this.href
	history.pushState(null, "", url)
	render(url)
}

function make_link(link, url) {
	link.href = url
	link.onclick = link_onclick
}

// idea: maybe put like/rt/reply count under avtaar?
function draw_tweet(data) {
	if (data.legacy.retweeted_status_result) {
		data = data.legacy.retweeted_status_result.result
	}
	let tweet = data.legacy
	let user = data.core.user_results.result.legacy
	let quoted = null
	if (tweet.quoted_status_id_str) {
		if (data.quoted_status_result && data.quoted_status_result.result)
			quoted = draw_tweet(data.quoted_status_result.result)
	}
	
	let ids = template($Tweet)
	
	
	ids.avatar.src = user.profile_image_url_https.replace("_normal", "_bigger")
	ids.avatar.width = 73
	ids.avatar.height = 73
	ids.name.textContent = user.name
	ids.username.textContent = "@"+user.screen_name
	
	make_link(ids.avatar_link, "https://twitter.com/@"+user.screen_name)
	make_link(ids.name_link, "https://twitter.com/@"+user.screen_name)
	make_link(ids.username_link, "https://twitter.com/@"+user.screen_name)
	
	ids.contents.replaceChildren(format_text(tweet.full_text, tweet.entities, tweet.extended_entities))
	ids.likes.textContent = tweet.favorite_count
	ids.retweets.textContent = tweet.retweet_count
	ids.replies.textContent = tweet.reply_count + tweet.quote_count
	
	if (quoted)
		ids.contents.appendChild(quoted)
	
	return ids.main
}

function draw_user(user) {
	let ids = template($Profile)
	if (user.profile_banner_url) {
		ids.banner.src = user.profile_banner_url+"/1500x500"
		//ids.banner.width = 1500
		//ids.banner.height = 500
	} else {
		ids.banner.hidden = true
	}
	
	ids.avatar.src = user.profile_image_url_https.replace('_normal', '')
	ids.name.textContent = user.name
	ids.username.textContent = "@"+user.screen_name
	ids.bio.replaceChildren(format_text(user.description, user.entities.description))
	ids.website.replaceChildren(format_text(user.url, user.entities.url))
	ids.location.textContent = user.location
	ids.joined.textContent = user.created_at
	
	ids.follower_count.textContent = user.normal_followers_count
	ids.tweet_count.textContent = user.statuses_count
	
	return ids.main
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

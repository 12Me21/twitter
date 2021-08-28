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
		for (let item of entities[type]) {
			parts.push({type:type, value:item, start:item.indices[0]})
			parts.push({start:item.indices[1]})
		}
	}
	parts.sort((a,b) => a.start-b.start)
	text = [...text] // this splits the string by CODEPOINT unlike .substring which uses utf-16 characters
	console.log(parts)
	for (let i=0; i<parts.length; i++) {
		let part = parts[i];
		let elem;
		if (part.type=='urls') {
			elem = document.createElement('a')
			elem.textContent = part.value.display_url
			elem.href = part.value.expanded_url
		} else if (part.type=='hashtags') {
			elem = document.createElement('a')
			elem.textContent = "#"+part.value.text
		} else if (part.type=='media') {
			elem = document.createElement('img')
			elem.className += ' tweet-image'
			elem.src = part.value.media_url_https
		} else if (part.type=='user_mentions') {
			elem = document.createElement('a')
			elem.textContent = "@"+part.value.screen_name
			elem.href = "https://twitter.com/@"+part.value.screen_name
		} else if (part.type=='symbols') {
			elem = document.createElement('a')
			elem.textContent = part.value.text
		} else {
			let next = parts[i+1]
			if (next)
				next = next.start
			else
				next = text.length
			if (next > part.start)
				elem = document.createTextNode(text.slice(part.start, next).join(""))
		}
		if (elem)
			frag.appendChild(elem)
	}
	return frag
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
	ids.contents.replaceChildren(format_text(tweet.full_text, tweet.entities))
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
		ids.banner.width = 1500
		ids.banner.height = 500
	} else {
		ids.banner.hidden = true
	}
	
	ids.avatar.src = user.profile_image_url_https.replace('_normal', '')
	ids.name.textContent = user.name
	ids.username.textContent = "@"+user.screen_name
	console.log(user)
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

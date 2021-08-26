function e(name, parent, cls) {
	let elem = document.createElement(name)
	if (parent)
		parent.append(elem)
	if (cls)
		elem.className = cls
	return elem
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
	
	for (let i=0; i<parts.length; i++) {
		let part = parts[i];
		let elem;
		if (part.type=='urls') {
			elem = e('a')
			elem.textContent = part.value.display_url
			elem.href = part.value.expanded_url
		} else if (part.type=='hashtag') {
			elem = e('a')
			elem.textContent = "#"+part.value.text
		} else if (part.type=='media') {
			elem = e('img', null, 'tweet-image')
			elem.src = part.value.media_url_https
		} else if (part.type=='user_mentions') {
			elem = e('a')
			elem.textContent = "@"+part.value.screen_name
			elem.href = "https://twitter.com/@"+part.value.screen_name
		} else if (part.type=='symbols') {
			elem = e('a')
			elem.textContent = part.value.text
		} else {
			let next = parts[i+1]
			if (next)
				next = next.start
			else
				next = text.length
			if (next > part.start)
				elem = document.createTextNode(text.substring(part.start, next))
		}
		if (elem)
			frag.appendChild(elem)
	}
	return frag
}

// idea: maybe put like/rt/reply count under avtaar?
function draw_tweet(data) {
	if (data.legacy.retweeted_status_result)
		data = data.legacy.retweeted_status_result.result
	let tweet = data.legacy
	let user = data.core.user_results.result.legacy
	let quoted = null
	if (tweet.quoted_status_id_str) {
		quoted = draw_tweet(data.quoted_status_result.result)
	}
	
	let box = e('flex-row', null, 'tweet')
	let avatar_box = e('div', box)
	let avatar = e('img', avatar_box, 'avatar')
	avatar.src = user.profile_image_url_https.replace("_normal", "_bigger")
	avatar.width = 73
	avatar.height = 73
	
	let box2 = e('flex-col', box, 'grow')
	let header = e('div', box2, 'flex-row tweet-header')
	let name = e('div', header, 'pre name')
	name.textContent = user.name
	let username = e('div', header, 'pre username')
	username.textContent = "@"+user.screen_name
	let contents = e('div', box2, 'pre tweet-contents')
	contents.replaceChildren(format_text(tweet.full_text, tweet.entities))
	let footer = e('div', box2, 'flex-row')
	footer.textContent = `💙${tweet.favorite_count} 🔁${tweet.retweet_count} 🗩${tweet.reply_count+tweet.quote_count}`
	
	if (quoted)
		contents.appendChild(quoted)
	
	return box
}

function draw_user(user) {
	//console.log(user)
	$profile_banner.style.backgroundImage = `url(${user.profile_banner_url}/1500x500)`
	$profile_picture.src = user.profile_image_url_https.replace('_normal', '')
	$profile_name.textContent = user.name
	$profile_username.textContent = "@"+user.screen_name
	
	$profile_bio.replaceChildren(format_text(user.description, user.entities.description))
	
	$profile_website.replaceChildren(format_text(user.url, user.entities.url))
	
	$profile_location.textContent = user.location
	
	$profile_joined.textContent = user.created_at
	
	$profile_follower_count.textContent = user.normal_followers_count
	$profile_tweet_count.textContent = user.statuses_count
	
	//$profile_tweets.replaceChildren(draw_tweet())
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

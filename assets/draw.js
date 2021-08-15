function format_text(text, entities) {
	let parts = [{type:'text',start:0}]
	for (let url of entities.urls) {
		parts.push({type:'link',value:url,start:url.indices[0]})
		parts.push({type:'text',start:url.indices[1]})
	}
	let frag = document.createDocumentFragment()
	for (let i=0; i<parts.length; i++) {
		let part = parts[i];
		let elem;
		if (part.type=='text') {
			let next = parts[i+1]
			if (next)
				next = next.start
			else
				next = text.length
			elem = document.createTextNode(text.substring(part.start, next))
		} else if (part.type=='link') {
			elem = document.createElement('a')
			elem.textContent = part.value.display_url
			elem.href = part.value.expanded_url
		}
		if (elem)
			frag.appendChild(elem)
	}
	return frag
}

function draw_tweet(tweet) {
	let elem = document.createElement('div')
	elem.className += ' flex-row'
	let avatar = document.createElement('img')
	
}

function draw_user(user) {
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

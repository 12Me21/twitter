let bearer, querys, token

async function init() {
	if (localStorage.tw2auth) {
		;({bearer, querys, token} = JSON.parse(localStorage.tw2auth))
		return
	}
	let text = await (await fetch("https://abs.twimg.com/responsive-web/client-web/main.91699ca5.js")).text();
	bearer = text.match(/a="Web-12",s="(.*?)"/)[1]
	querys = {}
	text.match(/\{queryId:".*?",operationName:".*?",operationType:".*?"\}/g).forEach(x=>{
		let d = JSON.parse(x.replace(/(\w+):/g,'"$1":'))
		querys[d.operationName] = d
	})
	token = (await (await fetch("https://api.twitter.com/1.1/guest/activate.json", {method:"POST",headers: {authorization: "Bearer "+bearer,}})).json()).guest_token
	localStorage.tw2auth = JSON.stringify({bearer, querys, token})
}

function graphql_url(type, params) {
	let q = querys[type]
	return `https://twitter.com/i/api/graphql/${q.queryId}/${q.operationName}?variables=${encodeURIComponent(JSON.stringify(params))}`
}

async function get_graphql(type, params) {
	let url = graphql_url(type, params)
	let resp = await fetch(url, {
		headers: {
			Authorization: "Bearer "+bearer,
			'x-guest-token': token,
		},
	})
	return await resp.json()
}

async function get_tweet(id) {
	let data = await get_graphql('TweetDetail', {
		focalTweetId: id,
		with_rux_injections: false,
		includePromotedContent: false,
		withCommunity: false,
		withTweetQuoteCount: true,
		withBirdwatchNotes: false,
		withSuperFollowsUserFields: false,
		withUserResults: true,
		withBirdwatchPivots: false,
		withReactionsMetadata: false,
		withReactionsPerspective: false,
		withSuperFollowsTweetFields: false,
		withVoice: false,
	})
	console.log(data)
	data = data.data.threaded_conversation_with_injections.instructions[0].entries.find(x=>x.entryId==`tweet-${id}`).content.itemContent.tweet_results.result
	return data
}

async function get_user(name) {
	let r1 = await get_graphql('UserByScreenName',{
		screen_name: name,
		withSafetyModeUserFields: false,
		withSuperFollowsUserFields: false
	})
	let user = r1.data.user.result
	let r2 = await get_graphql('UserTweets', {"userId":user.rest_id,"count":20,"withTweetQuoteCount":true,"includePromotedContent":true,"withSuperFollowsUserFields":false,"withUserResults":true,"withBirdwatchPivots":false,"withReactionsMetadata":false,"withReactionsPerspective":false,"withSuperFollowsTweetFields":false,"withVoice":true})
	console.log(r2)
	let tweets = r2.data.user.result.timeline.timeline.instructions.find(x=>x.type=='TimelineAddEntries').entries
	let pinned = r2.data.user.result.timeline.timeline.instructions.find(x=>x.type=='TimelinePinEntry')
	if (pinned)
		pinned = pinned.entry.content.itemContent.tweet_results.result
	return [user.legacy, pinned, tweets.filter(x=>/^tweet-/.test(x.entryId)).map(x=>x.content.itemContent.tweet_results.result)]
}

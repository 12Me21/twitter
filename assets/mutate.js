// oops why is this in this file
Promise.prototype.trap = function(type, a2, a3) {
	if (a3) {
		return this.catch(err=>{
			if (err instanceof type && err.name == a2)
				return a3(err)
			throw err
		})
	} else {
		return this.catch(err=>{
			if (err instanceof type)
				return a2(err)
			throw err
		})
	}
}

class ApiError extends Error {
	constructor(resp) {
		super(JSON.stringify(resp))
		console.log("constructing error: ", resp)
		this.errors = resp.errors
		this.data = resp.data
		this.name = 'ApiError'
	}
}

class Mutate {
	constructor(auth) {
		this.auth = auth
		//this.abort_controller = new AbortController()
		//this.signal = this.abort_controller.signal
	}
	
	async post_v11(url, body, extra_headers) {
		let resp = await fetch("https://twitter.com/i/api/1.1/"+url, {
			method: 'POST',
			headers: {
				...this.auth.auth_headers(),
				...extra_headers,
			},
			body: new URLSearchParams(body),
			signal: this.signal,
		})
		let data = await resp.json()
		if (x.ok)
			return data
		throw new ApiError(data)
		// ex: 
		// 404 - {errors: [{code: 34, message: "Sorry, that page does not exist."}]} (ex: when trying to unfollow a user that doesn't exist)
		// 403 - {errors: [{code: 108, message: "Cannot find specified user."}]} (ex: when trying to follow a user that doesn't exist)
		// http error code itself seems to be somewhat arbitrary
	}
	
	// todo: ugh
	post_v11_json(url, body) {
		return fetch("https://twitter.com/i/api/1.1/"+url, {
			method: 'POST',
			headers: {
				'Content-Type': "application/json",
				...this.auth.auth_headers(),
			},
			body: JSON.stringify(body),
			signal: this.signal,
		}).then(x=>x.json())
	}
	
	async post_graphql(type, params, body) {
		let q = this.auth.app.mutations[type]
		let resp = await fetch(`https://twitter.com/i/api/graphql/${q}/${type}`, {
			method: 'POST',
			headers: {
				'Content-Type': "application/json;charset=UTF-8",
				...this.auth.auth_headers(),
			},
			body: JSON.stringify({variables: JSON.stringify(params), queryId: q.queryId}), // god you can't make this shit up
			signal: this.signal,
		}).then(x=>x.json())
		// YOUR ERRORS COME BACK AS 200 OK
		if (resp.errors && resp.errors.length)
			throw new ApiError(resp)
		return resp.data
	}
	
	retweet(id) {
		return this.post_graphql('CreateRetweet', {
			tweet_id: id,
			dark_request: false,
		})
		// success:
		/* {
			data:{create_retweet:{retweet_results:{result:{rest_id:<tweet-id>,legacy:{full_text:<text>}}}}}
		}*/
		// error, already retweeted:
		/*{
			data:{},
			errors:[{
				message:"Authorization: You have already retweeted this Tweet. (327)",
				path:["create_retweet"],
				locations:[{line:<line>,column:<column>}],
				name:"AuthorizationError",
				source:"Client",
				code:327,
				kind:"Permissions",
				tracing:{trace_id:<id>},
				extensions:{name:"AuthorizationError",source:"Client",code:327,kind:"Permissions",tracing:{trace_id:<id>}}
			}]
		}*/
	}
	
	delete_retweet(id) {
		return this.post_graphql('DeleteRetweet', {
			source_tweet_id: id,
			dark_request: false,
		})
		// success: (regardless of whether the tweet was retweeted to begin with)
		// {unretweet:{source_tweet_results:{result:{rest_id:<id>,legacy:{full_text:<text>}}}}}
		
	}
	
	// note: to react to a retweet, the reaction should be created on the retweet, not the original tweet
	// it will be redirected to the original, but this allows the retweeter to get a notification about you liking their retweet etc.
	// react(id) - like a tweet
	// react(id, false) - remove reaction
	// react(id, reaction_type) - use a different rection (i.e. "Hmm", "Sad", etc.)
	react(id, type='Like') {
		return this.post_graphql('CreateTweetReaction', {
			tweet_id: id,
			reaction_type: type,
		})
		// on success: (regardless of whether reaction already exists)
		// {data:{create_reaction: {success:true}}}
	}
	
	delete_react(id) {
		return this.post_graphql('DeleteTweetReaction', {
			tweet_id: id,
		})
		// on success: (regardless of whether reaction existed)
		// {data:{delete_reaction: {success:true}}}
	}
	
	pin_tweet(id) {
		return this.post_v11("account/pin_tweet.json", {
			id: id,
			tweet_mode: 'extended',
		})
	}
	unpin_tweet(id) {
		return this.post_v11("account/unpin_tweet.json", {
			id: id,
			tweet_mode: 'extended',
		})
	}
	
	schedule_tweet(text, date) {
		return this.post_graphql('CreateScheduledTweet', {
			post_tweet_request: {
				status: text,
				//in_reply_to_status_id: ,
				exclude_reply_user_ids: [],
				auto_populate_reply_metadata: false,
				media_ids: [],
			},
			execute_at: Math.round(date.getTime()/1000),
		})
	}
	
	tweet(text) {
		return this.post_graphql('CreateTweet', {
			tweet_text: text,
			media: {media_entities: [], possibly_sensitive: false},
			dark_request: false,
			semantic_annotation_ids: [],
			
			...query_junk,
		})
	}
	
	reply(id, text) {
		return this.post_graphql('CreateTweet', {
			tweet_text: text,
			media: {media_entities: [], possibly_sensitive: false},
			reply: {
				in_reply_to_tweet_id: id,
				exclude_reply_user_ids: []
			},
			batch_compose: 'BatchSubsequent',
			
			dark_request: false,
			semantic_annotation_ids: [],
			...query_junk,
		})
	}
	
	bookmark(id) {
		return this.post_graphql('CreateBookmark', {
			tweet_id: id,
		})
		// success:
		// {data:{tweet_bookmark_put: "Done"}}
		
		// already bookmarked error:
		/* {message:"BadRequest: You have already bookmarked this Tweet.", path:["tweet_bookmark_put"], locations:[{line:2,column:3}], name:"BadRequestError", source:"Client", code:405, kind:"Validation",tracing:{trace_id:"6d25b01bb8671187"},extensions:{"name":"BadRequestError","source":"Client","code":405,"kind":"Validation","tracing":{"trace_id":"6d25b01bb8671187"}}}*/
		// bookmarking a retweet error: (and probably nonexistant tweets too)
		/*{"message":"_Missing: Sorry that page does not exist","path":["tweet_bookmark_put"],"locations":[{"line":2,"column":3}],"name":"GenericError","source":"Server","code":34,"kind":"NonFatal","tracing":{"trace_id":"91aabcbf0415b1bf"},"extensions":{"name":"GenericError","source":"Server","code":34,"kind":"NonFatal","tracing":{"trace_id":"91aabcbf0415b1bf"}}}*/
	}
	
	delete_bookmark(id) {
		return this.post_graphql('DeleteBookmark', {
			tweet_id: id,
		})
	}
	
		// data fields:
	// (only pass the ones you want to change)
	// `birthdate_day`, `birthdate_month`, `birthdate_year` - number
	// `birthdate_visibility`, `birthdate_year_visibility` - enum: self, public, followers, following, mutualfollow
	// `displayNameMaxLength` - number
	// `name` - string
	// `url` - string
	// `location` - string
	// `description` - string
	// `profile_link_color` - RRGGBB hex string
	update_profile(data) {
		return this.post_v11('account/update_profile.json', {
			skip_status: 1,
			...data
		})
	}
	
	log_out() {
		//return this.post_v11('account/logout', {})
	}
	
	delete_tweet(id) {
		return this.post_graphql('DeleteTweet', {
			tweet_id: id,
			dark_request: false,
		})
	}
	
	create_metadata(id, data) {
		return this.post_v11_json("media/metadata/create.json", {
			media_id: id,
			...data,
		})
		//{\"media_id\":\"1435940797451579395\",\"alt_text\":{\"text\":\"screenshot of html code\\ninside <body> are two elements, named <time-line> and <box-where-i-hide-the-template-elements>\"}}
	}
	
	async upload_image(file) {
		let r1 = await fetch("https://upload.twitter.com/i/media/upload.json"+encode_url_params({command: 'INIT', total_bytes: file.size, media_type: file.type, media_category: 'tweet_image'}), {
			method: 'POST',
			headers: this.auth.auth_headers(),
			signal: this.signal,
		}).then(x=>x.json())
		//expires_after_secs: 86400
		//media_id: 1435940797451579400
		//media_id_string: "1435940797451579395"
		//media_key: "3_1435940797451579395"
		
		let fd = new FormData()
		fd.set('media', file)
		
		let r2 = await fetch("https://upload.twitter.com/i/media/upload.json"+encode_url_params({command: 'APPEND', media_id: r1.media_id_string, segment_index: 0}), {
			method: 'POST',
			headers: this.auth.auth_headers(),
			body: fd,
			signal: this.signal,
		}).then(x=>x.text())
		
		let r3 = await fetch("https://upload.twitter.com/i/media/upload.json"+encode_url_params({command: 'FINALIZE', media_id: r1.media_id_string}), {
			method: 'POST',
			headers: this.auth.auth_headers(),
			signal: this.signal,
		}).then(x=>x.json())
		return r3
	}
	
	list_subscribe(id) {
		return this.post_graphql('ListSubscribe', {
			listId: id,
			withSuperFollowsUserFields: true,
			withUserResults: true,
		})
	}
	list_unsubscribe(id) {
		return this.post_graphql('ListUnsubscribe', {
			listId: id,
			withSuperFollowsUserFields: true,
			withUserResults: true,
		})
	}
	
	list_pin(id) {
		return this.post_graphql('ListPinOne', {
			listId: id,
			withSuperFollowsUserFields: true,
			withUserResults: false
		})
	}
	list_unpin(id) {
		return this.post_graphql('ListUnpinOne', {
			listId: id,
			withSuperFollowsUserFields: true,
			withUserResults: false
		})
	}

	// add a user to a list.
	// note: the UI lets you add/remove a user to multiple lists at once, but this is just processed using multiple requests to ListAddMember and ListRemoveMember
	list_add_member(list_id, user_id) {
		return this.post_graphql('ListAddMember', {
			listId: list_id,
			userId: user_id,
			withSuperFollowsUserFields: true,
			withUserResults: true,
		})
		// success: 
		// {"data":{"list":{"created_at":1585878427000,"default_banner_media":{"media_info":{"original_img_url":"https://pbs.twimg.com/media/EXZ2w_qUcAMwN3x.png","original_img_width":1125,"original_img_height":375,"salient_rect":{"left":562,"top":187,"width":1,"height":1}}},"description":"test","following":true,"id_str":<list id>,"member_count":14,"mode":"Private","user_results":{"result":{"__typename":"User","id":"VXNlcjo3MDA0NTA0Njk3NjQ4NjYwNDg=","rest_id":<list owner id>,"affiliates_highlighted_label":{},"legacy":{<list data>},"super_follow_eligible":false,"super_followed_by":false,"super_following":false}},"name":"test","is_member":false,"subscriber_count":0,"muting":false,"pinning":true}}}
	}
	list_remove_member(list_id, user_id) {
		return this.post_graphql('ListRemoveMember', {
			listId: list_id,
			userId: user_id,
			withSuperFollowsUserFields: true,
			withUserResults: true,
		})
		// success: 
		// (same as list_add_member)
	}
	
	mute_user(id) {
		return this.post_v11('mutes/users/create.json', {
			//impression_id: ??
			user_id: id,
		})
	}
	unmute_user(id) { //hmm.. i kinda like the pattern of using "un-" prefix for deletion methods... "untweet" "list_unadd_member" lol
		return this.post_v11('mutes/users/destroy.json', {
			user_id: id,
		})
	}
	block(id) {
		return this.post_v11('blocks/create.json', {
			//impression_id: ??
			user_id: id,
		})
	}
	unblock(id) {
		return this.post_v11('blocks/destroy.json', { // ⛏
			user_id: id,
		})
	}
	// enable/disable showing retweets from this user in your timeline
	retweets(id, state) {
		return this.post_v11('friendships/update.json', {
			cursor: -1,
			id: id,
			retweets: state,
		})
		// success:
		// {relationship: {source:{<user>}, target:{<user>}}}
	}
	// enable/disable getting notifications for this user's actions i guess
	notify(id, state) {
		return this.post_v11('friendships/update.json', {
			cursor: -1,
			id: id,
			device: state,
		})
		// success:
		// {relationship: {source:{<user>}, target:{<user>}}}
	}
	follow(id) {
		return this.post_v11('friendships/create.json', {
			id: id,
		})
		// success: returns user object (even if user is already followed/unfollowed)
	}
	unfollow(id) {
		return this.post_v11('friendships/destroy.json', { //💔
			id: id,
		})
	}
	
	// 1984
	// mode can be:
	// - 'ByInvitation' (people you mentioned + you)
	// - 'Community' (people you follow + you)
	// - none (everyone)
	conversation_control(tweet_id, mode) {
		if (mode) {
			return this.post_graphql('ConversationControlChange', {
				tweet_id: tweet_id,
				mode: mode,
			})
		} else {
			return this.post_graphql('ConversationControlDelete', {
				tweet_id: tweet_id,
			})
		}
		// success:
		// {data: {tweet_conversation_control_put: "Done"}}
		// {data: {tweet_conversation_control_delete: "Done"}}
	}
	
	mute_conversation(id) {
		return this.post_v11('mutes/conversations/create.json', {
			tweet_mode: 'extended',
			tweet_id: id,
		})
		// success: returns tweet obj
	}
	unmute_conversation(id) {
		return this.post_v11('mutes/conversations/destroy.json', {
			tweet_mode: 'extended',
			tweet_id: id,
		})
		// success: returns tweet obj
	}
	
	task_test() {
		return this.post_v11_json('onboarding/task.json?flow_name=login', {
			input_flow_data:{
				flow_context:{
					debug_overrides:{},
					start_location:{location:"splash_screen"}
				}
			},
			subtask_versions:{
				contacts_live_sync_permission_prompt:0,
				email_verification:1,
				topics_selector:1,
				wait_spinner:1,
				cta:4
			}
		})
	}
	
	task_test2(token, st) {
		return this.post_v11_json('onboarding/task.json', {
			flow_token: token,
			subtask_inputs: st,
		})
	}
}

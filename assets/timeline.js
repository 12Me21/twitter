class Timeline {
	constructor(insts, objects, gen) {
		let ids = template($Timeline)
		this.elem = ids.main
		this.gen = gen
		this.add_instructions(insts, objects)
	}
	
	add_instructions(insts, objects) {
		if (objects) { // v2 format
			for (let inst of insts.instructions) {
				if (inst.addEntries) {
					for (let entry of inst.addEntries.entries)
						this.add_entry(entry, objects)
				} else {
					this.add_elem(draw_unknown("? Instruction", inst))
				}
			}				
		} else { // graphql format
			for (let inst of insts.instructions) {
				let type = inst.type
				if (type=='TimelineAddEntries') {
					for (let entry of inst.entries)
						this.add_entry(entry)
				} else if (type=='TimelinePinEntry') {
					this.add_entry(inst.entry)
				} else if (type=='TimelineAddToModule') {
					this.add_to_entry(inst.moduleEntryId, inst.moduleItems)
					// todo: check `prepend`
				} else {
					this.add_elem(draw_unknown("? Instruction", inst))
				}
			}
		}
	}

	draw_cursor(cursor) {
		let ids = template($Cursor)
		ids.main.dataset.cursor = cursor.value
		ids.main.x_timeline = this
		return ids.main
	}
	
	// an 'entry' contains 0 or more 'items', grouped together
	draw_entry(entry, objects) {
		let elem = document.createElement('tl-entry')
		elem.className
		elem.dataset.order = entry.sortIndex
		elem.dataset.id = entry.entryId
		let content = entry.content
		
		if (objects) { //new format
			if (content.timelineModule) {
				for (let item of content.timelineModule.items) {
					let x = this.draw_item(item.item, objects)
					if (x)
						elem.append(x)
				}
			} else if (content.item) {
				let x = this.draw_item(content.item, objects)
				if (x)
					elem.append(x)
			} else if (content.operation) {
				if (content.operation.cursor) {
					elem.append(this.draw_cursor(content.operation.cursor))
				} else
					elem.textContent = "entry "+JSON.stringify(content)
			} else {
				elem.textContent = "entry "+JSON.stringify(content)
			}
		} else { //old format
			let type = content.entryType
			if (type=='TimelineTimelineItem') {
				let x = this.draw_item(content)
				if (x)
					elem.append(x)
				// todo: so it seems like there's a distinction between "items" vs "modules"
				// where modules are used for like, replies, and can contain multiple tweets and have stuff added to them.
			} else if (type=='TimelineTimelineModule') {
				for (let item of content.items) {
					let x = this.draw_item(item.item)
					if (x)
						elem.append(x)
				}
			} else if (type=='TimelineTimelineCursor') {
				elem.append(this.draw_cursor(content))
			} else {
				elem.append(draw_unknown("Entry: "+type, content))
			}
		}
		if (elem.childNodes.length==0)
			return null
		return elem
	}
	
	// todo: error checking here
	// Convert a tweet from graphql format to v2 format
	// `result`: the result field from a graphql response
	// `objects`: an empty globalObjects table. will be written to (this is the primary output)
	// return: the id of the tweet
	tweet_to_v2(result, objects) {
		try {
			if (!result || result.__typename=='TweetUnavailable') // this can happen when a user's pinned tweet has been deleted
				return null
			objects.tweets[result.legacy.id_str] = result.legacy
			if (result.legacy.retweeted_status_result) {
				result.legacy.retweeted_status_id_str = this.tweet_to_v2(result.legacy.retweeted_status_result.result, objects)
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
				this.tweet_to_v2(result.quoted_status_result.result, objects)
			}
			if (result.card) {
				result.legacy.card = result.card.legacy
				let map = {}
				for (let x of result.card.legacy.binding_values) {
					map[x.key] = x.value
				}
				result.legacy.card.binding_values = map
			}
			
			let user = result.core.user_results.result
			objects.users[user.rest_id] = user.legacy
			
			return result.legacy.id_str
		} catch (e) {
			console.log("failed to convert tweet:", result)
			throw(e)
		}
	}
	
	// an 'item' is a single tweet, or other widget, that appears in the timeline
	draw_item(item, objects) {
		try {
			if (objects) {
				let content = item.content
				if (content.tweet) {
					if (content.tweet.promotedMetadata)
						return null
					let elem = draw_tweet(content.tweet.id, objects)
					let sc = content.tweet.socialContext
					// todo: draw_context_label function
					if (sc) {
						if (sc.generalContext) {
							let x = document.createElement('div')
							x.append(sc.generalContext.text)
							x.append(elem)
							return x
						} else if (sc.topicContext) {
							let t = objects.topics[sc.topicContext.topicId]
							if (t) {
								let x = document.createElement('div')
								x.append("Topic: "+t.name)
								x.append(elem)
								return x
							}
						}
					}
					return elem
				} else if (content.notification) {
					return draw_notification(objects.notifications[content.notification.id])
				}
				return draw_unknown("Item", content)
			} else {
				let content = item.itemContent
				let type = content.itemType
				
				if (type=='TimelineTweet') {
					let result = content.tweet_results.result
					let objects = {tweets:{}, users:{}, topics:{}}// todo: fill more?
					let id = this.tweet_to_v2(content.tweet_results.result, objects)
					return draw_tweet(id, objects)
				} else if (type=='TimelineTimelineCursor') {
					return this.draw_cursor(content)
				} else if (type=='TimelineTwitterList') {
					return draw_list(content.list)
				} else if (type=='TimelineUser') {
					return null
					//console.log(content)
					//return draw_user(content.user_results.result.legacy)
				} else if (type=='TimelineTopic') {
					return null
				}
				return draw_unknown("Item", content)
			}
		} catch (e) {
			console.error(e)
			return draw_unknown("Item Error", item)
		}
	}
	
	add_elem(elem) {
		this.elem.append(elem)
	}
	
	add_to_entry(id, list, objects) {
		for (let child of this.elem.children) {
			if (child.dataset.id==id) {
				for (let x of list) {
					// todo: prevent inserting duplicate items
					child.append(this.draw_item(x.item, objects))
				}
				return true
			}
		}
		return false
	}
	
	add_entry(entry, objects) {
		if (/promotedTweet-/y.test(entry.entryId))
			return
		let elem = this.draw_entry(entry, objects)
		if (!elem)
			return
		let after = null
		// todo: reverse the search I guess, since most items get inserted at the bottom
		// todo: prevent duplicate
		for (let child of this.elem.children) {
			if (child.dataset.order < elem.dataset.order) {
				after = child
				break
			}
		}
		this.elem.insertBefore(elem, after)
	}
	
	add_to(parent) {
		parent.append(this.elem)
	}
}

// idea: often a timeline will contain "cursor" entries/instructions
// these should, essentially, re-send the same request, but with the cursor field set.
// so, perhaps the timeline element should store info about the request as attributes.
// either a full list of raw request parameters or just the Query method name and its arguments.
// so, when a cursor is activated, it looks at its parent timeline to see how to perform the request


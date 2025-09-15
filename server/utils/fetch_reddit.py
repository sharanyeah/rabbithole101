#!/usr/bin/env python3
import sys
import json
import requests
from urllib.parse import quote, urlencode

def fetch_reddit(query, limit=5):
    try:
        all_results = []

        search_strategies = [
            search_programming_subreddits,
            search_topic_specific_subreddits,
            search_learning_subreddits,
            search_technical_subreddits
        ]

        for strategy in search_strategies:
            try:
                strategy_results = strategy(query, limit)
                all_results.extend(strategy_results)

            except Exception as e:
                continue

        unique_results = remove_duplicates_and_rank_reddit(all_results, query)

        if len(unique_results) == 0:
            return generate_fallback_reddit_results(query, limit)

        return unique_results[:limit]

    except Exception as e:
        return generate_fallback_reddit_results(query, limit)

def search_programming_subreddits(query, limit):
    programming_subreddits = [
        'learnprogramming', 'programming', 'coding', 'AskProgramming',
        'webdev', 'softwaredevelopment', 'compsci', 'algorithms'
    ]

    results = []
    for subreddit in programming_subreddits:
        try:
            subreddit_results = search_subreddit(subreddit, query, limit)
            results.extend(subreddit_results)
        except Exception as e:
            continue

    return results

def search_topic_specific_subreddits(query, limit):
    subreddit_mapping = {
        'javascript': ['javascript', 'node', 'reactjs', 'vuejs', 'angular'],
        'python': ['python', 'learnpython', 'datascience', 'MachineLearning'],
        'java': ['learnjava', 'java', 'springframework'],
        'react': ['reactjs', 'frontend', 'webdev'],
        'machine learning': ['MachineLearning', 'datascience', 'artificial'],
        'data science': ['datascience', 'analytics', 'bigdata'],
        'web development': ['webdev', 'frontend', 'backend'],
        'database': ['database', 'sql', 'mongodb'],
        'mobile': ['androiddev', 'iOSProgramming', 'reactnative'],
        'devops': ['devops', 'kubernetes', 'docker'],
        'security': ['netsec', 'cybersecurity', 'AskNetSec']
    }

    query_lower = query.lower()
    relevant_subreddits = []

    for topic, subreddits in subreddit_mapping.items():
        if topic in query_lower or any(word in query_lower for word in topic.split()):
            relevant_subreddits.extend(subreddits)

    results = []
    for subreddit in list(set(relevant_subreddits))[:5]:
        try:
            subreddit_results = search_subreddit(subreddit, query, limit)
            results.extend(subreddit_results)
        except Exception as e:
            continue

    return results

def search_learning_subreddits(query, limit):
    learning_subreddits = [
        'explainlikeimfive', 'todayilearned', 'YouShouldKnow',
        'learnmath', 'askscience', 'NoStupidQuestions'
    ]

    results = []
    for subreddit in learning_subreddits:
        try:
            subreddit_results = search_subreddit(subreddit, query, limit)
            results.extend(subreddit_results)
        except Exception as e:
            continue

    return results

def search_technical_subreddits(query, limit):
    technical_subreddits = [
        'ExperiencedDevs', 'cscareerquestions', 'TrueReddit',
        'technology', 'sysadmin', 'programming'
    ]

    results = []
    for subreddit in technical_subreddits:
        try:
            subreddit_results = search_subreddit(subreddit, query, limit)
            results.extend(subreddit_results)
        except Exception as e:
            continue

    return results

def search_subreddit(subreddit, query, limit):
    results = []

    search_approaches = [
        ('relevance', 'all'),
        ('top', 'year'),
        ('hot', None),
        ('new', None)
    ]

    for sort, time_filter in search_approaches:
        try:
            approach_results = search_subreddit_with_params(
                subreddit, query, sort, time_filter, limit
            )
            results.extend(approach_results)

            if len(results) >= limit * 2:
                break

        except Exception as e:
            continue

    return results

def search_subreddit_with_params(subreddit, query, sort, time_filter, limit):
    search_url = f"https://www.reddit.com/r/{subreddit}/search.json"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    params = {
        'q': query,
        'restrict_sr': 'on',
        'sort': sort,
        'limit': min(limit * 3, 25),
        'type': 'link'
    }

    if time_filter:
        params['t'] = time_filter

    response = requests.get(search_url, headers=headers, params=params, timeout=10)
    response.raise_for_status()

    data = response.json()
    results = []

    for item in data.get('data', {}).get('children', []):
        try:
            post = item.get('data', {})

            if not is_quality_reddit_post(post, query):
                continue

            title = post.get('title', '')
            url = f"https://www.reddit.com{post.get('permalink', '')}"
            score = post.get('score', 0)
            num_comments = post.get('num_comments', 0)
            author = post.get('author', '[deleted]')

            description = create_reddit_description(post, subreddit)

            result = {
                'title': title,
                'url': url,
                'description': description,
                'metadata': {
                    'source': 'Reddit',
                    'subreddit': subreddit,
                    'score': score,
                    'num_comments': num_comments,
                    'author': author,
                    'created_utc': post.get('created_utc', 0),
                    'gilded': post.get('gilded', 0),
                    'is_self': post.get('is_self', False)
                }
            }

            results.append(result)

        except Exception as e:
            continue

    return results

def is_quality_reddit_post(post, query):
    num_comments = post.get('num_comments', 0)
    if num_comments < 5:
        return False

    score = post.get('score', 0)
    if score < 1:
        return False

    title = post.get('title', '').lower()
    query_words = query.lower().split()
    if not any(word in title for word in query_words):
        return False

    if post.get('author') in ['[deleted]', '[removed]']:
        return False

    if post.get('removed_by_category') or post.get('banned_by'):
        return False

    if post.get('is_self') and num_comments > 10:
        return True

    if num_comments > 0 and score > 0:
        engagement_ratio = num_comments / max(score, 1)
        if engagement_ratio > 0.1:
            return True

    if post.get('gilded', 0) > 0:
        return True

    return num_comments >= 10

def create_reddit_description(post, subreddit):
    score = post.get('score', 0)
    num_comments = post.get('num_comments', 0)
    author = post.get('author', '[deleted]')
    gilded = post.get('gilded', 0)

    description_parts = [f"r/{subreddit}"]

    description_parts.append(f"{score} upvotes")
    description_parts.append(f"{num_comments} comments")

    if gilded > 0:
        description_parts.append(f"🥇 {gilded} gold")

    if post.get('is_self'):
        description_parts.append("📝 Text post")

    if post.get('stickied'):
        description_parts.append("📌 Pinned")

    if num_comments > 20:
        description_parts.append("🔥 Active discussion")
    elif num_comments > 10:
        description_parts.append("💬 Good discussion")

    selftext = post.get('selftext', '')
    if selftext and len(selftext) > 50:
        preview = selftext[:150].replace('\n', ' ').strip()
        description_parts.append(f"• {preview}...")

    return " • ".join(description_parts)

def remove_duplicates_and_rank_reddit(results, query):
    seen_urls = set()
    unique_results = []

    scored_results = []
    for result in results:
        score = calculate_reddit_quality_score(result, query)
        scored_results.append((score, result))

    scored_results.sort(key=lambda x: x[0], reverse=True)

    for score, result in scored_results:
        if result['url'] not in seen_urls and score > 0:
            seen_urls.add(result['url'])
            unique_results.append(result)

    return unique_results

def calculate_reddit_quality_score(result, query):
    metadata = result.get('metadata', {})
    score = 0

    upvotes = metadata.get('score', 0)
    comments = metadata.get('num_comments', 0)

    if upvotes > 10:
        score += 2
    if upvotes > 50:
        score += 2
    if upvotes > 100:
        score += 3

    if comments >= 5:
        score += 3
    if comments >= 15:
        score += 3
    if comments >= 30:
        score += 4

    if metadata.get('gilded', 0) > 0:
        score += 5

    title = result['title'].lower()
    query_words = query.lower().split()
    for word in query_words:
        if word in title:
            score += 2

    if metadata.get('is_self'):
        score += 2

    if comments > 0 and upvotes > 0:
        engagement_ratio = comments / max(upvotes, 1)
        if engagement_ratio > 0.2:
            score += 3
        elif engagement_ratio > 0.1:
            score += 2

    subreddit = metadata.get('subreddit', '').lower()
    quality_subreddits = [
        'askscience', 'explainlikeimfive', 'programming', 
        'learnprogramming', 'datascience', 'experienceddevs'
    ]
    if subreddit in quality_subreddits:
        score += 2

    return score

def generate_fallback_reddit_results(query, limit):
    return [{
        'title': 'Sorry peeps nothing to see here',
        'url': '',
        'description': 'No Reddit discussions found for this specific topic',
        'metadata': {
            'source': 'Reddit',
            'fallback': True
        }
    }]

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(1)

    query = sys.argv[1]
    results = fetch_reddit(query)
    print(json.dumps(results, indent=2))
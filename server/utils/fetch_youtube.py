#!/usr/bin/env python3
import sys
import json
import requests
from urllib.parse import urlencode
from datetime import datetime, timedelta

def fetch_youtube(query, limit=5):
    try:
        import os
        api_key = os.environ.get('YOUTUBE_API_KEY')

        if not api_key:
            return generate_fallback_youtube_results(query, limit)

        search_queries = generate_specific_search_queries(query)
        all_results = []

        for search_query in search_queries:
            try:
                educational_results = search_youtube_educational(api_key, search_query, limit)
                all_results.extend(educational_results)

                tutorial_results = search_youtube_tutorials(api_key, search_query, limit)
                all_results.extend(tutorial_results)

                recent_results = search_youtube_recent(api_key, search_query, limit)
                all_results.extend(recent_results)

            except Exception as e:
                continue

        unique_results = remove_duplicates_and_rank(all_results, query)

        if len(unique_results) == 0:
            return generate_fallback_youtube_results(query, limit)

        return unique_results[:limit]

    except Exception as e:
        return generate_fallback_youtube_results(query, limit)

def generate_specific_search_queries(base_query):
    queries = []
    queries.append(f"{base_query} tutorial")
    queries.append(f"{base_query} explained")
    queries.append(f"{base_query} course")
    queries.append(f"{base_query} fundamentals")
    queries.append(f"{base_query} guide")
    queries.append(f"learn {base_query}")
    queries.append(f"{base_query} documentation")
    queries.append(f"{base_query} examples")
    return queries

def search_youtube_educational(api_key, query, limit):
    base_url = "https://www.googleapis.com/youtube/v3/search"

    params = {
        'part': 'snippet',
        'q': f"{query} tutorial OR explained OR course",
        'type': 'video',
        'maxResults': limit * 3,
        'key': api_key,
        'order': 'relevance',
        'safeSearch': 'moderate',
        'videoDuration': 'medium',
        'videoDefinition': 'high',
        'relevanceLanguage': 'en'
    }

    return make_youtube_request(base_url, params, query, 'educational')

def search_youtube_tutorials(api_key, query, limit):
    base_url = "https://www.googleapis.com/youtube/v3/search"

    params = {
        'part': 'snippet',
        'q': f"how to {query} OR {query} step by step OR {query} guide",
        'type': 'video',
        'maxResults': limit * 2,
        'key': api_key,
        'order': 'relevance',
        'safeSearch': 'moderate',
        'videoDuration': 'any',
        'relevanceLanguage': 'en'
    }

    return make_youtube_request(base_url, params, query, 'tutorial')

def search_youtube_recent(api_key, query, limit):
    base_url = "https://www.googleapis.com/youtube/v3/search"

    six_months_ago = (datetime.now() - timedelta(days=180)).isoformat() + 'Z'

    params = {
        'part': 'snippet',
        'q': f"{query} 2024 OR {query} latest",
        'type': 'video',
        'maxResults': limit * 2,
        'key': api_key,
        'order': 'date',
        'safeSearch': 'moderate',
        'publishedAfter': six_months_ago,
        'relevanceLanguage': 'en'
    }

    return make_youtube_request(base_url, params, query, 'recent')

def make_youtube_request(base_url, params, original_query, search_type):
    try:
        url = f"{base_url}?{urlencode(params)}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        data = response.json()
        results = []

        for item in data.get('items', []):
            try:
                video_id = item['id']['videoId']
                snippet = item['snippet']

                title = snippet.get('title', '')
                channel = snippet.get('channelTitle', '')
                description = snippet.get('description', '')
                published_at = snippet.get('publishedAt', '')

                if not is_quality_video(title, channel, description, original_query):
                    continue

                video_details = get_video_details(params['key'], video_id)

                result = {
                    'title': title,
                    'url': f"https://www.youtube.com/watch?v={video_id}",
                    'description': f"{channel} • {description[:200]}{'...' if len(description) > 200 else ''}",
                    'metadata': {
                        'source': 'YouTube',
                        'videoId': video_id,
                        'channelTitle': channel,
                        'publishedAt': published_at,
                        'searchType': search_type,
                        'thumbnails': snippet.get('thumbnails', {}),
                        'details': video_details
                    }
                }

                results.append(result)

            except Exception as e:
                continue

        return results
    except Exception as e:
        return []

def get_video_details(api_key, video_id):
    try:
        base_url = "https://www.googleapis.com/youtube/v3/videos"
        params = {
            'part': 'statistics,contentDetails',
            'id': video_id,
            'key': api_key
        }

        url = f"{base_url}?{urlencode(params)}"
        response = requests.get(url, timeout=5)
        response.raise_for_status()

        data = response.json()
        if data.get('items'):
            item = data['items'][0]
            return {
                'duration': item.get('contentDetails', {}).get('duration', ''),
                'viewCount': item.get('statistics', {}).get('viewCount', '0'),
                'likeCount': item.get('statistics', {}).get('likeCount', '0')
            }
    except:
        pass

    return {}

def is_quality_video(title, channel, description, query):
    title_lower = title.lower()
    query_lower = query.lower()

    query_words = query_lower.split()
    if not any(word in title_lower for word in query_words):
        return False

    spam_indicators = [
        'subscribe', 'smash that like', 'notification bell',
        'click here', 'download now', 'free money',
        'you won\'t believe', 'shocking', 'gone wrong'
    ]

    if any(spam in title_lower for spam in spam_indicators):
        return False

    if len(title) < 15:
        return False

    educational_indicators = [
        'tutorial', 'course', 'learn', 'guide', 'explained',
        'documentation', 'fundamentals', 'basics', 'advanced',
        'programming', 'coding', 'development', 'tech'
    ]

    return any(indicator in title_lower or indicator in description.lower() 
              for indicator in educational_indicators)

def remove_duplicates_and_rank(results, original_query):
    seen_urls = set()
    unique_results = []

    scored_results = []
    for result in results:
        score = calculate_relevance_score(result, original_query)
        scored_results.append((score, result))

    scored_results.sort(key=lambda x: x[0], reverse=True)

    for score, result in scored_results:
        if result['url'] not in seen_urls:
            seen_urls.add(result['url'])
            unique_results.append(result)

    return unique_results

def calculate_relevance_score(result, query):
    score = 0
    title = result['title'].lower()
    query_words = query.lower().split()

    for word in query_words:
        if word in title:
            score += 2

    educational_keywords = ['tutorial', 'course', 'learn', 'guide', 'explained']
    for keyword in educational_keywords:
        if keyword in title:
            score += 1

    details = result.get('metadata', {}).get('details', {})
    view_count = int(details.get('viewCount', 0))
    if view_count > 10000:
        score += 1
    if view_count > 100000:
        score += 1

    return score

def generate_fallback_youtube_results(query, limit):
    return [{
        'title': 'Sorry peeps nothing to see here',
        'url': '',
        'description': 'No YouTube resources found for this specific topic',
        'metadata': {
            'source': 'YouTube',
            'fallback': True
        }
    }]

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(1)

    query = sys.argv[1]
    results = fetch_youtube(query)
    print(json.dumps(results, indent=2))
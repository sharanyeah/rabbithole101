
#!/usr/bin/env python3
import sys
import json
import os

# Add error handling for missing modules
try:
    import requests
    import re
    from urllib.parse import quote
    import time
except ImportError as e:
    print(json.dumps([{
        'title': 'Module Import Error',
        'url': '',
        'snippet': f'Missing required module: {str(e)}',
        'source': 'reddit'
    }]))
    sys.exit(0)

def search_reddit(query, limit=5):
    """Search Reddit using JSON endpoints"""
    results = []
    
    try:
        # Use Reddit's JSON endpoint (no API key needed)
        search_terms = [
            f"{query} tutorial",
            f"learning {query}",
            f"{query} guide",
            f"{query} beginner"
        ]
        
        headers = {
            'User-Agent': 'Learning Platform Bot 1.0 (Educational Use)'
        }
        
        for search_term in search_terms[:2]:  # Limit to 2 searches to avoid rate limits
            try:
                # Search in relevant subreddits
                subreddits = ['learnprogramming', 'tutorials', 'explainlikeimfive', 'education']
                
                for subreddit in subreddits[:2]:  # Limit subreddits
                    url = f"https://www.reddit.com/r/{subreddit}/search.json"
                    params = {
                        'q': search_term,
                        'restrict_sr': 'on',
                        'sort': 'relevance',
                        'limit': 3
                    }
                    
                    response = requests.get(url, params=params, headers=headers, timeout=8)
                    
                    if response.status_code == 200:
                        data = response.json()
                        
                        for post in data.get('data', {}).get('children', []):
                            post_data = post.get('data', {})
                            title = post_data.get('title', '')
                            url = post_data.get('url', '')
                            selftext = post_data.get('selftext', '')
                            score = post_data.get('score', 0)
                            
                            if title and score > 5:  # Filter for quality posts
                                results.append({
                                    'title': title,
                                    'url': f"https://reddit.com{post_data.get('permalink', '')}",
                                    'snippet': selftext[:200] + '...' if len(selftext) > 200 else selftext,
                                    'score': score,
                                    'subreddit': subreddit,
                                    'source': 'reddit'
                                })
                    
                    time.sleep(0.5)  # Rate limiting
                    
            except Exception:
                continue
                
        # Sort by score and limit results
        results = sorted(results, key=lambda x: x.get('score', 0), reverse=True)
        
    except Exception as e:
        pass  # Fail silently
    
    return results[:limit]

if __name__ == "__main__":
    if len(sys.argv) > 1:
        query = sys.argv[1]
        results = search_reddit(query)
        print(json.dumps(results))
    else:
        print(json.dumps([]))

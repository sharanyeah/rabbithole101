
#!/usr/bin/env python3
import sys
import json
import requests
from urllib.parse import quote, urlencode

def fetch_wikipedia(query, limit=5):
    try:
        all_results = []
        
        search_strategies = [
            search_wikipedia_direct,
            search_wikipedia_related_topics,
            search_wikipedia_technical_content,
            search_wikipedia_categories
        ]
        
        for strategy in search_strategies:
            try:
                strategy_results = strategy(query, limit)
                all_results.extend(strategy_results)
                
            except Exception as e:
                continue
        
        unique_results = remove_duplicates_and_rank_wikipedia(all_results, query)
        
        if len(unique_results) == 0:
            return generate_fallback_wikipedia_results(query, limit)
            
        return unique_results[:limit]
        
    except Exception as e:
        return generate_fallback_wikipedia_results(query, limit)

def search_wikipedia_direct(query, limit):
    results = []
    
    search_url = "https://en.wikipedia.org/w/api.php"
    search_params = {
        'action': 'query',
        'format': 'json',
        'list': 'search',
        'srsearch': query,
        'srlimit': limit * 2,
        'srprop': 'snippet|titlesnippet|size|wordcount|timestamp'
    }
    
    headers = {
        'User-Agent': 'RabbitHole Learning Platform (educational use)'
    }
    
    try:
        response = requests.get(search_url, headers=headers, params=search_params, timeout=10)
        response.raise_for_status()
        
        search_data = response.json()
        search_results = search_data.get('query', {}).get('search', [])
        
        for item in search_results:
            try:
                page_title = item.get('title', '')
                page_id = item.get('pageid', '')
                snippet = clean_wikipedia_snippet(item.get('snippet', ''))
                word_count = item.get('wordcount', 0)
                
                page_details = get_wikipedia_page_details(page_id, headers)
                
                if page_details and is_quality_wikipedia_page(page_details, query):
                    result = create_wikipedia_result(page_details, snippet, query)
                    results.append(result)
                        
            except Exception as e:
                continue
    
    except Exception as e:
        pass
    
    return results

def search_wikipedia_related_topics(query, limit):
    results = []
    
    related_queries = generate_related_wikipedia_queries(query)
    
    for related_query in related_queries[:3]:
        try:
            search_params = {
                'action': 'query',
                'format': 'json',
                'list': 'search',
                'srsearch': related_query,
                'srlimit': 5,
                'srprop': 'snippet|titlesnippet|size|wordcount'
            }
            
            headers = {'User-Agent': 'RabbitHole Learning Platform (educational use)'}
            response = requests.get(
                "https://en.wikipedia.org/w/api.php", 
                headers=headers, 
                params=search_params, 
                timeout=8
            )
            
            if response.status_code == 200:
                data = response.json()
                search_results = data.get('query', {}).get('search', [])
                
                for item in search_results:
                    page_id = item.get('pageid', '')
                    page_details = get_wikipedia_page_details(page_id, headers)
                    
                    if page_details and is_quality_wikipedia_page(page_details, query):
                        snippet = clean_wikipedia_snippet(item.get('snippet', ''))
                        result = create_wikipedia_result(page_details, snippet, related_query)
                        results.append(result)
        
        except Exception as e:
            continue
    
    return results

def search_wikipedia_technical_content(query, limit):
    technical_terms = [
        f"{query} (computer science)",
        f"{query} programming",
        f"{query} algorithm",
        f"{query} theory",
        f"{query} implementation",
        f"{query} methodology"
    ]
    
    results = []
    for tech_term in technical_terms:
        try:
            search_params = {
                'action': 'query',
                'format': 'json',
                'list': 'search',
                'srsearch': tech_term,
                'srlimit': 3,
                'srprop': 'snippet|size|wordcount'
            }
            
            headers = {'User-Agent': 'RabbitHole Learning Platform (educational use)'}
            response = requests.get(
                "https://en.wikipedia.org/w/api.php", 
                headers=headers, 
                params=search_params, 
                timeout=8
            )
            
            if response.status_code == 200:
                data = response.json()
                search_results = data.get('query', {}).get('search', [])
                
                for item in search_results:
                    page_id = item.get('pageid', '')
                    page_details = get_wikipedia_page_details(page_id, headers)
                    
                    if page_details:
                        snippet = clean_wikipedia_snippet(item.get('snippet', ''))
                        result = create_wikipedia_result(page_details, snippet, tech_term)
                        results.append(result)
        
        except Exception as e:
            continue
    
    return results

def search_wikipedia_categories(query, limit):
    results = []
    
    try:
        category_search_params = {
            'action': 'query',
            'format': 'json',
            'list': 'allcategories',
            'acprefix': query,
            'aclimit': 5
        }
        
        headers = {'User-Agent': 'RabbitHole Learning Platform (educational use)'}
        response = requests.get(
            "https://en.wikipedia.org/w/api.php", 
            headers=headers, 
            params=category_search_params, 
            timeout=8
        )
        
        if response.status_code == 200:
            data = response.json()
            categories = data.get('query', {}).get('allcategories', [])
            
            for category in categories[:2]:
                category_name = category.get('*', '')
                
                category_pages = get_wikipedia_category_pages(category_name, headers)
                
                for page_info in category_pages[:3]:
                    page_details = get_wikipedia_page_details(page_info.get('pageid'), headers)
                    if page_details and is_quality_wikipedia_page(page_details, query):
                        result = create_wikipedia_result(
                            page_details, 
                            f"From category: {category_name}", 
                            query
                        )
                        results.append(result)
    
    except Exception as e:
        pass
    
    return results

def get_wikipedia_page_details(page_id, headers):
    if not page_id:
        return None
    
    try:
        details_params = {
            'action': 'query',
            'format': 'json',
            'pageids': page_id,
            'prop': 'extracts|info|sections|links',
            'exintro': True,
            'exlimit': 1,
            'exsectionformat': 'plain',
            'inprop': 'url',
            'pllimit': 10
        }
        
        response = requests.get(
            "https://en.wikipedia.org/w/api.php", 
            headers=headers, 
            params=details_params, 
            timeout=8
        )
        
        if response.status_code == 200:
            data = response.json()
            pages = data.get('query', {}).get('pages', {})
            
            if str(page_id) in pages:
                page_data = pages[str(page_id)]
                
                sections = get_wikipedia_page_sections(page_id, headers)
                
                return {
                    'pageid': page_id,
                    'title': page_data.get('title', ''),
                    'extract': page_data.get('extract', ''),
                    'fullurl': page_data.get('fullurl', ''),
                    'sections': sections,
                    'links': page_data.get('links', [])
                }
    
    except Exception as e:
        pass
    
    return None

def get_wikipedia_page_sections(page_id, headers):
    try:
        sections_params = {
            'action': 'parse',
            'format': 'json',
            'pageid': page_id,
            'prop': 'sections'
        }
        
        response = requests.get(
            "https://en.wikipedia.org/w/api.php", 
            headers=headers, 
            params=sections_params, 
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            sections = data.get('parse', {}).get('sections', [])
            return [section.get('line', '') for section in sections[:8]]
    
    except Exception as e:
        pass
    
    return []

def get_wikipedia_category_pages(category_name, headers):
    try:
        category_params = {
            'action': 'query',
            'format': 'json',
            'list': 'categorymembers',
            'cmtitle': f"Category:{category_name}",
            'cmlimit': 5,
            'cmtype': 'page'
        }
        
        response = requests.get(
            "https://en.wikipedia.org/w/api.php", 
            headers=headers, 
            params=category_params, 
            timeout=8
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get('query', {}).get('categorymembers', [])
    
    except Exception as e:
        pass
    
    return []

def generate_related_wikipedia_queries(query):
    base_query = query.lower()
    related_queries = []
    
    related_queries.extend([
        f"{query} overview",
        f"{query} introduction",
        f"{query} basics",
        f"{query} principles",
        f"{query} fundamentals"
    ])
    
    if any(term in base_query for term in ['programming', 'code', 'software']):
        related_queries.extend([
            f"{query} language",
            f"{query} framework",
            f"{query} library",
            f"{query} development"
        ])
    
    if any(term in base_query for term in ['data', 'machine', 'learning']):
        related_queries.extend([
            f"{query} science",
            f"{query} analysis",
            f"{query} statistics",
            f"{query} model"
        ])
    
    return related_queries

def is_quality_wikipedia_page(page_details, query):
    title = page_details.get('title', '').lower()
    extract = page_details.get('extract', '').lower()
    query_lower = query.lower()
    
    query_words = query_lower.split()
    if not any(word in title or word in extract for word in query_words):
        return False
    
    if len(extract) < 200:
        return False
    
    if 'disambiguation' in title or title.startswith('list of'):
        return False
    
    sections = page_details.get('sections', [])
    if len(sections) >= 3:
        return True
    
    if len(extract) > 1000:
        return True
    
    return len(extract) > 300

def create_wikipedia_result(page_details, snippet, search_query):
    title = page_details.get('title', '')
    extract = page_details.get('extract', '')
    sections = page_details.get('sections', [])
    
    description_parts = []
    
    if snippet:
        description_parts.append(snippet[:150])
    elif extract:
        description_parts.append(extract[:150])
    
    if sections:
        section_preview = ', '.join(sections[:4])
        description_parts.append(f"Sections: {section_preview}")
    
    if len(extract) > 2000:
        description_parts.append("📖 Comprehensive article")
    elif len(extract) > 1000:
        description_parts.append("📄 Detailed content")
    
    description = ' • '.join(description_parts)
    
    return {
        'title': title,
        'url': page_details.get('fullurl', ''),
        'description': description[:300] + ('...' if len(description) > 300 else ''),
        'metadata': {
            'source': 'Wikipedia',
            'pageid': page_details.get('pageid', ''),
            'wordcount': len(extract.split()) if extract else 0,
            'sections': sections,
            'search_query': search_query,
            'content_length': len(extract) if extract else 0
        }
    }

def clean_wikipedia_snippet(snippet):
    if not snippet:
        return ""
    
    import re
    snippet = re.sub(r'<[^>]+>', '', snippet)
    
    snippet = snippet.replace('&quot;', '"')
    snippet = snippet.replace('&amp;', '&')
    snippet = snippet.replace('&lt;', '<')
    snippet = snippet.replace('&gt;', '>')
    
    return snippet.strip()

def remove_duplicates_and_rank_wikipedia(results, query):
    seen_urls = set()
    unique_results = []
    
    scored_results = []
    for result in results:
        score = calculate_wikipedia_relevance_score(result, query)
        scored_results.append((score, result))
    
    scored_results.sort(key=lambda x: x[0], reverse=True)
    
    for score, result in scored_results:
        if result['url'] not in seen_urls and score > 0:
            seen_urls.add(result['url'])
            unique_results.append(result)
    
    return unique_results

def calculate_wikipedia_relevance_score(result, query):
    score = 0
    title = result['title'].lower()
    description = result['description'].lower()
    metadata = result.get('metadata', {})
    
    query_words = query.lower().split()
    for word in query_words:
        if word in title:
            score += 3
        if word in description:
            score += 1
    
    content_length = metadata.get('content_length', 0)
    if content_length > 2000:
        score += 3
    elif content_length > 1000:
        score += 2
    elif content_length > 500:
        score += 1
    
    sections = metadata.get('sections', [])
    if len(sections) > 5:
        score += 2
    elif len(sections) > 3:
        score += 1
    
    word_count = metadata.get('wordcount', 0)
    if word_count > 1000:
        score += 1
    
    return score

def generate_fallback_wikipedia_results(query, limit):
    return [{
        'title': 'Sorry peeps nothing to see here',
        'url': '',
        'description': 'No Wikipedia articles found for this specific topic',
        'metadata': {
            'source': 'Wikipedia',
            'fallback': True
        }
    }]

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(1)
    
    query = sys.argv[1]
    results = fetch_wikipedia(query)
    print(json.dumps(results, indent=2))

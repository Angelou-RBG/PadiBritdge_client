import React, { useEffect, useState } from 'react';
import PostCard from './PostCard';
import { getPosts } from '../services/api';

const PAGE_SIZE = 15;

export default function FeedGet() {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const offset = posts.length;

  useEffect(() => {
    let isActive = true;

    async function loadInitialPosts() {
      try {
        const data = await getPosts({ limit: PAGE_SIZE, offset: 0 });
        const nextPosts = Array.isArray(data?.posts) ? data.posts : [];

        if (!isActive) {
          return;
        }

        if (nextPosts.length === 0) {
          setHasError(true);
          setPosts([]);
          setHasMore(false);
          return;
        }

        setPosts(nextPosts);
        setHasMore(Boolean(data?.hasMore));
      } catch (error) {
        if (isActive) {
          setHasError(true);
          setPosts([]);
          setHasMore(false);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadInitialPosts();

    return () => {
      isActive = false;
    };
  }, []);

  if (isLoading) {
    return <div className="post-card">Loading posts...</div>;
  }

  async function handleLoadMore() {
    if (isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const data = await getPosts({ limit: PAGE_SIZE, offset });
      const nextPosts = Array.isArray(data?.posts) ? data.posts : [];

      setPosts((currentPosts) => [...currentPosts, ...nextPosts]);
      setHasMore(Boolean(data?.hasMore));
    } catch (error) {
      setHasError(true);
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (hasError && posts.length === 0) {
    return <div className="post-card">Something went Wrong</div>;
  }

  if (posts.length === 0) {
    return <div className="post-card">No posts available.</div>;
  }

  return (
    <div className="feed-post-list">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {hasMore ? (
        <button type="button" className="primary-btn load-more-btn" onClick={handleLoadMore} disabled={isLoadingMore}>
          {isLoadingMore ? 'Loading...' : 'Load More'}
        </button>
      ) : null}
    </div>
  );
}
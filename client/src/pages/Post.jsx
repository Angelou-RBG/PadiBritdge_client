import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import CommentSection from '../components/CommentSection';
import FloatingDropdown from '../components/FloatingDropdown';
import DeletePostCard from '../components/DeletePostCard';
import NotificationBean from '../components/NotificationBean';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/FilterContext';
import { deletePost, getPost, getStockListings, getAddress, baseURL } from '../services/api';
import { getTagStyle, normalizeTag } from '../utils/tagTheme';
import MediaHandler from '../components/MediaHandler';
import './Post.css';

function formatTags(tags, globalTags = []) {
  const tagArray = Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);
  
  return tagArray.map((tag, index) => {
    const found = globalTags.find(t => String(t.id) === String(tag));
    if (found) {
      return { id: found.id, name: found.name, color: found.color };
    }
    return normalizeTag(tag, index);
  });
}

function formatImages(images) {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((image, index) => ({
      id: image?.id ?? `${image?.url || 'image'}-${index}`,
      url: image?.url || image?.imageUrl || '',
      alt: image?.originalName || `Post image ${index + 1}`,
    }))
    .filter((image) => Boolean(image.url));
}

function getPostTypeStyle(type) {
  if (type === 'PadiConnect') return { backgroundColor: '#166534', color: '#ffffff', border: '1px solid #14532d' };
  if (type === 'PadiSwap') return { backgroundColor: '#c2410c', color: '#ffffff', border: '1px solid #9a3412' };
  return { backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
}

export default function Post() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user } = useAuth();
  const { globalTags } = useFilters();
  const [post, setPost] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(location.state?.flash || null);
  const [isDeleteCardOpen, setIsDeleteCardOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [millerStocks, setMillerStocks] = useState([]);
  const [address, setAddress] = useState(null);

  useEffect(() => {
    let isActive = true;

    async function loadPost() {
      try {
        const data = await getPost(id);

        if (!isActive) {
          return;
        }

        setPost(data?.post || null);

        const addressId = data?.post?.address_id || data?.post?.addressId;
        if (addressId) {
          try {
            const addr = await getAddress(addressId);
            if (isActive) setAddress(addr);
          } catch (e) {
            console.error('Failed to load address', e);
          }
        }

        if (data?.post?.postType === 'PadiConnect' && data?.post?.attachmentType === 'stock_listing') {
          try {
            const stocksData = await getStockListings({ userId: data.post.user_id || data.post.userId });
            if (isActive) {
              setMillerStocks(stocksData?.stockListings || []);
            }
          } catch (e) {
            console.error('Failed to load stock listing', e);
          }
        }
      } catch (error) {
        if (isActive) {
          setNotification({
            type: 'error',
            message: error.response?.data?.message || 'Something went Wrong',
          });
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadPost();

    return () => {
      isActive = false;
    };
  }, [id]);

  const tagList = useMemo(() => formatTags(post?.tags, globalTags), [post?.tags, globalTags]);
  const imageList = useMemo(() => formatImages(post?.images), [post?.images]);
  const currentUserId = String(user?.id || user?._id || '');
  const postOwnerId = String(post?.user_id || post?.userId || '');
  const isCurrentUser = Boolean(currentUserId && postOwnerId && currentUserId === postOwnerId);
  const postId = String(post?.post_id || id || '');
  const pfp = post?.profile_picture || post?.profilePicture;
  const isDeleted = post?.status === 'deleted';
  const isPadiConnect = post?.postType === 'PadiConnect';

  const dropdownItems = useMemo(() => {
    const items = [
      {
        id: 'post-info',
        label: 'Post Info',
      },
    ];

    if (isCurrentUser) {
      items.push(
        {
          id: 'edit-post',
          label: 'Edit Post',
          onClick: () => {
            if (postId) {
              navigate(`/edit/${postId}`);
            }
          },
        },
        {
          id: 'delete-post',
          label: 'Delete Post',
          className: 'floating-dropdown__item--danger',
          onClick: () => setIsDeleteCardOpen(true),
        }
      );

      return items;
    }

    items.push({
      id: 'report-post',
      label: 'Report Post',
    });

    return items;
  }, [isCurrentUser, navigate, postId]);

  if (isLoading) {
    return (
      <section className="post-page-shell">
        <button type="button" className="ghost-btn post-back-btn" onClick={() => navigate(-1)}>
          Back
        </button>
        <div className="post-page-loading">Loading post...</div>
      </section>
    );
  }

  if (!post) {
    return (
      <section className="post-page-shell">
        <NotificationBean type={notification?.type} message={notification?.message} />
        <button type="button" className="ghost-btn post-back-btn" onClick={() => navigate(-1)}>
          Back
        </button>
        <h2 className="post-page-title">Post not found</h2>
      </section>
    );
  }

  if (isDeleted) {
    return (
      <section className="post-page-shell">
        <div className="post-page-header post-page-header--deleted">
          <button type="button" className="ghost-btn post-back-btn" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>

        <div className="post-page-unavailable">Post is Unavailable</div>
      </section>
    );
  }

  const handleDeleteConfirm = async () => {
    if (!postId) {
      return;
    }

    try {
      setIsDeleting(true);
      const data = await deletePost(postId);

      if (data?.post?.status === 'deleted') {
        setPost((currentPost) => ({
          ...(currentPost || {}),
          post_id: postId,
          status: 'deleted',
        }));
      }

      setIsDeleteCardOpen(false);
    } catch (error) {
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Unable to delete post.' ,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="post-page-shell">
      <div className="post-page-header">
        <button type="button" className="ghost-btn post-back-btn" onClick={() => navigate(-1)}>
          Back
        </button>

        <FloatingDropdown
          className="post-page-actions-dropdown"
          trigger={<span className="post-page-actions-trigger" aria-hidden="true">⋯</span>}
          triggerAriaLabel="Post actions"
          items={dropdownItems}
          menuClassName="post-page-actions-menu"
        />
      </div>

      <DeletePostCard
        open={isDeleteCardOpen}
        onClose={() => setIsDeleteCardOpen(false)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />

      <NotificationBean type={notification?.type} message={notification?.message} />

      <h2 className="post-page-title" style={{ marginBottom: '0.05rem' }}>{post?.title || 'Untitled Post'}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {pfp ? (
            <img src={`${baseURL}/uploads/${pfp}`} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '35px', height: '35px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>👤</div>
          )}
          <div>
            <p className="post-card-user" style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>By {post?.user || 'Unknown user'}</p>
            {post?.username && <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>@{post.username}</p>}
          </div>
        </div>

        {address && (
          <div style={{ color: '#475569', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span>📍</span> {address.street}, {address.city}, {address.province}
          </div>
        )}

        <div className="post-page-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: '700',
            ...getPostTypeStyle(post?.postType)
          }}>
            {post?.postType || 'Other'}
          </span>
          <div className="post-page-tags" aria-label="Post tags" style={{ margin: 0 }}>
            {tagList.length > 0 ? tagList.map((tag) => (
              <span className="post-page-tag" key={tag.id} style={getTagStyle(tag.color)}>
                {tag.name}
              </span>
            )) : (
              <span className="post-page-tag post-page-tag-empty">No tags</span>
            )}
          </div>
        </div>
      </div>

      <div className="post-page-body">{post?.textBody || 'No post body available.'}</div>

      <MediaHandler images={imageList} />

      {isPadiConnect && post?.attachmentType === 'stock_listing' && millerStocks.length > 0 && (
        <div className="post-stock-table-container">
          <h4 style={{ marginBottom: '0.75rem' }}>Available Stock</h4>
          <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>Rice Brand / Variety</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>Quality Grade</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>Available Volume</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>Est. Wholesale Price (₱)</th>
                </tr>
              </thead>
              <tbody>
                {millerStocks.map((stock) => (
                  <tr key={stock.stock_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '500', color: '#0f172a' }}>{stock.name}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{stock.quality_grade}</td>
                    <td style={{ padding: '12px 16px', color: '#059669', fontWeight: '500' }}>{(stock.physical_sacks || 0) - (stock.allocated_sacks || 0)} sacks</td>
                    <td style={{ padding: '12px 16px', color: '#0f172a' }}>₱{Number(stock.wholesale_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isCurrentUser && (
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="ghost-btn">Contact Miller</button>
              <button type="button" className="primary-btn" onClick={() => navigate(`/reserve/${postId}`)}>Reserve Stock</button>
              <button type="button" className="primary-btn" style={{ backgroundColor: '#2563eb' }}>Purchase Stock with PadiConnect</button>
            </div>
          )}
        </div>
      )}

      <CommentSection postId={postId} />
    </section>
  );
}
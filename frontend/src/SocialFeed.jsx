import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "./SocialFeed.css";


const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const AUTH_ME_URL = `${API_BASE}/auth/me`;

const LOGIN_PATH = "/login";
const REGISTER_PATH = "/register";
const REPORT_PATH = "/report";

const REPORT_LOGIN_URL =
  `${LOGIN_PATH}?next=${encodeURIComponent(REPORT_PATH)}`;

const PUBLIC_STATUSES = [
  "Verified",
  "Official Notified",
  "Response Received",
  "Resolved",
];


const iconPaths = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
    </>
  ),

  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),

  map: (
    <>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15" />
    </>
  ),

  chart: (
    <>
      <path d="M4 20V10m6 10V4m6 16v-7m5 7H3" />
    </>
  ),

  plus: <path d="M12 5v14M5 12h14" />,

  pin: (
    <>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),

  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
  ),

  message: (
    <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 1 1 16.1-4Z" />
  ),

  repeat: (
    <>
      <path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" />
    </>
  ),

  share: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 14v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" />
    </>
  ),

  check: <path d="m5 12 4 4L19 6" />,

  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),

  alert: (
    <>
      <path d="m12 3 10 18H2L12 3Z" />
      <path d="M12 9v5m0 3h.01" />
    </>
  ),

  filter: (
    <>
      <path d="M4 7h16M7 12h10m-7 5h4" />
    </>
  ),

  arrow: (
    <path d="M5 12h14m-6-6 6 6-6 6" />
  ),

  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M5 9a8 8 0 0 1 14-2l1 5M4 12l1 5a8 8 0 0 0 14-2" />
    </>
  ),

  image: (
    <>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
      />

      <circle
        cx="8"
        cy="8"
        r="1"
      />

      <path d="m21 16-5-5L5 21" />
    </>
  ),

  video: (
    <>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="3"
      />

      <path d="m10 9 5 3-5 3z" />
    </>
  ),

  shield: (
    <>
      <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
};


function Icon({
  name,
  size = 19,
  ...props
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {iconPaths[name] || iconPaths.home}
    </svg>
  );
}


const asset = (path) => {
  if (
    !path ||
    typeof path !== "string"
  ) {
    return "";
  }

  if (
    path === "string"
  ) {
    return "";
  }

  if (
    /^https?:\/\//i.test(path)
  ) {
    return path;
  }

  return `${API_BASE}/${path.replace(/^\/+/, "")}`;
};


const isResolved = (complaint) =>
  complaint.status === "Resolved" ||
  String(
    complaint.resolution_status || ""
  )
    .toLowerCase()
    .trim() === "resolved";


const isOverdue = (complaint) =>
  complaint.deadline_crossed === "Yes" &&
  !isResolved(complaint) &&
  !complaint.response_date;


const dateValue = (item) =>
  new Date(
    item.created_at ||
    item.createdAt ||
    item.submitted_at ||
    item.date ||
    0
  ).getTime() ||
  Number(item.id) ||
  0;


function when(value) {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const difference =
    Date.now() - date.getTime();

  const minutes =
    Math.floor(
      difference / 60000
    );

  const hours =
    Math.floor(
      difference / 3600000
    );

  const days =
    Math.floor(
      difference / 86400000
    );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  if (days === 1) {
    return "Yesterday";
  }

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}


function status(complaint) {
  if (isResolved(complaint)) {
    return [
      "Resolved",
      "resolved",
    ];
  }

  if (
    complaint.status ===
    "Response Received"
  ) {
    return [
      "Authority responded",
      "responded",
    ];
  }

  if (isOverdue(complaint)) {
    return [
      "Needs attention",
      "overdue",
    ];
  }

  if (
    complaint.status ===
    "Official Notified"
  ) {
    return [
      "Official notified",
      "notified",
    ];
  }

  return [
    "Verified",
    "verified",
  ];
}


function location(complaint) {
  return [
    complaint.area,
    complaint.district,
    complaint.state,
  ]
    .filter(Boolean)
    .join(", ") || "India";
}


function Select({
  label,
  value,
  values,
  onChange,
  allLabel,
}) {
  return (
    <label className="jd-select">

      <span>
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      >

        <option value="All">
          {allLabel}
        </option>

        {values.map((item) => (

          <option
            key={item}
            value={item}
          >
            {item}
          </option>

        ))}

      </select>

    </label>
  );
}


export default function SocialFeed() {

  // =========================================================
  // COMPLAINTS
  // =========================================================

  const [
    complaints,
    setComplaints,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");


  // =========================================================
  // SOCIAL POSTS
  // =========================================================

  const [
    socialPosts,
    setSocialPosts,
  ] = useState([]);

  const [
    socialLoading,
    setSocialLoading,
  ] = useState(true);

  const [
    socialError,
    setSocialError,
  ] = useState("");


  // =========================================================
  // AUTH
  // =========================================================

  const [
    auth,
    setAuth,
  ] = useState({
    loading: true,
    user: null,
  });


  useEffect(() => {

    let mounted = true;

    fetch(
      AUTH_ME_URL,
      {
        credentials: "include",
        cache: "no-store",
      }
    )
      .then((response) => {

        if (!response.ok) {
          throw new Error(
            "Auth unavailable"
          );
        }

        return response.json();
      })
      .then((data) => {

        if (!mounted) {
          return;
        }

        setAuth({
          loading: false,

          user:
            data.authenticated === true ||
            data.isAuthenticated === true
              ? data.user || {}
              : null,
        });
      })
      .catch(() => {

        if (
          mounted
        ) {
          setAuth({
            loading: false,
            user: null,
          });
        }
      });

    return () => {
      mounted = false;
    };

  }, []);


  const reportUrl =
    auth.user
      ? REPORT_PATH
      : REPORT_LOGIN_URL;


  // =========================================================
  // POST COMPOSER
  // =========================================================

  const [
    postText,
    setPostText,
  ] = useState("");

  const [
    postImage,
    setPostImage,
  ] = useState(null);

  const [
    postVideo,
    setPostVideo,
  ] = useState(null);

  const [
    posting,
    setPosting,
  ] = useState(false);

  const [
    postMessage,
    setPostMessage,
  ] = useState("");

  const [
    postError,
    setPostError,
  ] = useState("");

  const imageInputRef =
    useRef(null);

  const videoInputRef =
    useRef(null);


  // =========================================================
  // FILTERS
  // =========================================================

  const [
    state,
    setState,
  ] = useState("All");

  const [
    district,
    setDistrict,
  ] = useState("All");

  const [
    area,
    setArea,
  ] = useState("All");

  const [
    category,
    setCategory,
  ] = useState("All");

  const [
    tab,
    setTab,
  ] = useState("All");

  const [
    sort,
    setSort,
  ] = useState("latest");

  const [
    search,
    setSearch,
  ] = useState("");


  // =========================================================
  // TEMPORARY SOCIAL INTERACTIONS
  // =========================================================

  const [
    likes,
    setLikes,
  ] = useState({});

  const [
    reposts,
    setReposts,
  ] = useState({});

  const [
    comments,
    setComments,
  ] = useState({});

  const [
    drafts,
    setDrafts,
  ] = useState({});

  const [
    commentOpen,
    setCommentOpen,
  ] = useState({});

  const [
    videoOpen,
    setVideoOpen,
  ] = useState({});

  const [
    filtersOpen,
    setFiltersOpen,
  ] = useState(false);


  // =========================================================
  // LOAD COMPLAINTS
  // =========================================================

  const fetchComplaints =
    async () => {

      setLoading(true);
      setError("");

      try {

        const response =
          await fetch(
            `${API_BASE}/complaints/`
          );

        if (!response.ok) {
          throw new Error(
            `Unable to load feed (${response.status})`
          );
        }

        const result =
          await response.json();

        setComplaints(
          Array.isArray(result)
            ? result
            : Array.isArray(
                result.complaints
              )
              ? result.complaints
              : []
        );

      } catch (err) {

        setError(
          err.message ||
          "Unable to load complaints"
        );

      } finally {

        setLoading(false);

      }
    };


  // =========================================================
  // LOAD SOCIAL POSTS
  // =========================================================

  const fetchSocialPosts =
    async () => {

      setSocialLoading(true);
      setSocialError("");

      try {

        const response =
          await fetch(
            `${API_BASE}/social-posts/`,
            {
              cache: "no-store",
            }
          );

        if (!response.ok) {
          throw new Error(
            `Unable to load community posts (${response.status})`
          );
        }

        const result =
          await response.json();

        setSocialPosts(
          Array.isArray(result)
            ? result
            : []
        );

      } catch (err) {

        setSocialError(
          err.message ||
          "Unable to load community posts."
        );

      } finally {

        setSocialLoading(false);

      }
    };


  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {

    const query =
      new URLSearchParams(
        window.location.search
      );

    setState(
      query.get("state") || "All"
    );

    setDistrict(
      query.get("district") || "All"
    );

    setArea(
      query.get("area") || "All"
    );

    fetchComplaints();

    fetchSocialPosts();

  }, []);


  // =========================================================
  // FILE UPLOAD
  // =========================================================

  const uploadFile =
    async (
      file,
      endpoint
    ) => {

      if (!file) {
        return null;
      }

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          `${API_BASE}/uploads/${endpoint}`,
          {
            method: "POST",
            body: formData,
          }
        );

      const result =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof result.detail ===
          "string"
            ? result.detail
            : "File upload failed."
        );
      }

      return result;
    };


  // =========================================================
  // CREATE COMMUNITY POST
  // =========================================================

  const createCommunityPost =
    async () => {

      setPostError("");
      setPostMessage("");

      if (!auth.user) {

        window.location.assign(
          "/login?next=%2Fsocial"
        );

        return;
      }

      const text =
        postText.trim();

      if (!text) {

        setPostError(
          "Write something before posting."
        );

        return;
      }

      try {

        setPosting(true);


        let imageUrl = null;
        let videoUrl = null;


        if (postImage) {

          setPostMessage(
            "Uploading photo..."
          );

          const result =
            await uploadFile(
              postImage,
              "image"
            );

          imageUrl =
            result?.path || null;
        }


        if (postVideo) {

          setPostMessage(
            "Uploading video..."
          );

          const result =
            await uploadFile(
              postVideo,
              "video"
            );

          videoUrl =
            result?.path || null;
        }


        setPostMessage(
          "Publishing..."
        );


        const response =
          await fetch(
            `${API_BASE}/social-posts/`,
            {
              method: "POST",

              credentials:
                "include",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  text,
                  image_url:
                    imageUrl,
                  video_url:
                    videoUrl,
                }),
            }
          );


        const result =
          await response
            .json()
            .catch(() => ({}));


        if (
          response.status === 401
        ) {

          window.location.assign(
            "/login?next=%2Fsocial"
          );

          return;
        }


        if (!response.ok) {

          throw new Error(
            typeof result.detail ===
            "string"
              ? result.detail
              : "Unable to publish post."
          );
        }


        setSocialPosts(
          (previous) => [
            result,
            ...previous,
          ]
        );


        setPostText("");
        setPostImage(null);
        setPostVideo(null);

        if (
          imageInputRef.current
        ) {
          imageInputRef.current.value =
            "";
        }

        if (
          videoInputRef.current
        ) {
          videoInputRef.current.value =
            "";
        }


        setPostMessage(
          "Posted successfully."
        );


        setTimeout(() => {

          setPostMessage("");

        }, 1800);

      } catch (err) {

        console.error(
          "Social post error:",
          err
        );

        setPostError(
          err.message ||
          "Unable to publish post."
        );

      } finally {

        setPosting(false);

      }
    };


  // =========================================================
  // PUBLIC COMPLAINTS
  // =========================================================

  const publicItems =
    useMemo(
      () =>
        complaints.filter(
          (complaint) =>
            PUBLIC_STATUSES.includes(
              complaint.status
            )
        ),
      [complaints]
    );


  const options = (
    key,
    items = publicItems
  ) => [
    ...new Set(
      items
        .map(
          (complaint) =>
            complaint[key]
        )
        .filter(Boolean)
    ),
  ].sort();


  const states =
    options("state");


  const districts =
    options(
      "district",
      publicItems.filter(
        (complaint) =>
          state === "All" ||
          complaint.state ===
            state
      )
    );


  const areas =
    options(
      "area",
      publicItems.filter(
        (complaint) =>
          (
            state === "All" ||
            complaint.state ===
              state
          ) &&
          (
            district === "All" ||
            complaint.district ===
              district
          )
      )
    );


  const categories =
    options(
      "category",
      publicItems.filter(
        (complaint) =>
          (
            state === "All" ||
            complaint.state ===
              state
          ) &&
          (
            district === "All" ||
            complaint.district ===
              district
          ) &&
          (
            area === "All" ||
            complaint.area ===
              area
          )
      )
    );


  // =========================================================
  // CIVIC STATS
  // =========================================================

  const stats =
    useMemo(
      () => ({
        total:
          publicItems.length,

        attention:
          publicItems.filter(
            isOverdue
          ).length,

        escalated:
          publicItems.filter(
            (complaint) =>
              complaint.social_escalated ===
              "Yes"
          ).length,

        resolved:
          publicItems.filter(
            isResolved
          ).length,
      }),
      [publicItems]
    );


  // =========================================================
  // FILTER COMPLAINTS
  // =========================================================

  const complaintFeed =
    useMemo(() => {

      let rows =
        publicItems.filter(
          (complaint) =>
            (
              state === "All" ||
              complaint.state ===
                state
            ) &&
            (
              district ===
                "All" ||
              complaint.district ===
                district
            ) &&
            (
              area === "All" ||
              complaint.area ===
                area
            ) &&
            (
              category ===
                "All" ||
              complaint.category ===
                category
            )
        );


      if (
        tab === "community"
      ) {
        return [];
      }


      if (
        tab === "attention"
      ) {
        rows =
          rows.filter(
            isOverdue
          );
      }


      if (
        tab === "escalated"
      ) {
        rows =
          rows.filter(
            (complaint) =>
              complaint.social_escalated ===
              "Yes"
          );
      }


      if (
        tab === "resolved"
      ) {
        rows =
          rows.filter(
            isResolved
          );
      }


      const query =
        search
          .trim()
          .toLowerCase();


      if (query) {

        rows =
          rows.filter(
            (complaint) =>
              [
                complaint.id,
                complaint.title,
                complaint.description,
                complaint.ai_summary,
                complaint.category,
                complaint.area,
                complaint.district,
                complaint.state,
                complaint.authority,
                complaint.status,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query)
          );
      }


      return rows.map(
        (complaint) => ({
          type: "complaint",
          id:
            complaint.id ??
            complaint._id,
          created_at:
            complaint.created_at ||
            complaint.createdAt ||
            complaint.submitted_at ||
            complaint.date,
          data: complaint,
        })
      );

    }, [
      publicItems,
      state,
      district,
      area,
      category,
      tab,
      search,
    ]);


  // =========================================================
  // FILTER COMMUNITY POSTS
  // =========================================================

  const communityFeed =
    useMemo(() => {

      if (
        ![
          "All",
          "community",
        ].includes(tab)
      ) {
        return [];
      }


      // Community posts currently do not
      // have geographic fields.
      //
      // If a geographic complaint filter
      // is active, hide them for now.
      if (
        state !== "All" ||
        district !== "All" ||
        area !== "All" ||
        category !== "All"
      ) {
        return [];
      }


      let rows = [
        ...socialPosts,
      ];


      const query =
        search
          .trim()
          .toLowerCase();


      if (query) {

        rows =
          rows.filter(
            (post) =>
              [
                post.text,
                post.username,
                post.name,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query)
          );
      }


      return rows.map(
        (post) => ({
          type: "community",
          id: post.id,
          created_at:
            post.created_at,
          data: post,
        })
      );

    }, [
      socialPosts,
      tab,
      search,
      state,
      district,
      area,
      category,
    ]);


  // =========================================================
  // MIXED CIVIC FEED
  // =========================================================

  const feed =
    useMemo(() => {

      const rows = [
        ...complaintFeed,
        ...communityFeed,
      ];


      const score = (
        item
      ) => {

        const key =
          `${item.type}-${item.id}`;

        let value =
          (likes[key] || 0) * 2 +
          (reposts[key] || 0) * 4 +
          (
            comments[key]
              ?.length || 0
          ) * 3;


        if (
          item.type ===
          "complaint"
        ) {

          if (
            isOverdue(
              item.data
            )
          ) {
            value += 6;
          }

          if (
            item.data
              .social_escalated ===
            "Yes"
          ) {
            value += 8;
          }
        }

        return value;
      };


      return rows.sort(
        (a, b) => {

          if (
            sort ===
            "trending"
          ) {
            return (
              score(b) -
                score(a) ||
              dateValue(b.data) -
                dateValue(a.data)
            );
          }


          if (
            sort ===
            "supported"
          ) {

            const aKey =
              `${a.type}-${a.id}`;

            const bKey =
              `${b.type}-${b.id}`;

            return (
              (
                likes[bKey] || 0
              ) +
                (
                  reposts[bKey] ||
                  0
                ) *
                  2 -
              (
                likes[aKey] || 0
              ) -
              (
                reposts[aKey] ||
                0
              ) *
                2
            );
          }


          return (
            dateValue(b.data) -
            dateValue(a.data)
          );
        }
      );

    }, [
      complaintFeed,
      communityFeed,
      sort,
      likes,
      reposts,
      comments,
    ]);


  // =========================================================
  // CLEAR FILTERS
  // =========================================================

  const clear = () => {

    setState("All");
    setDistrict("All");
    setArea("All");
    setCategory("All");
    setTab("All");
    setSort("latest");
    setSearch("");

    window.history.replaceState(
      {},
      "",
      window.location.pathname
    );
  };


  // =========================================================
  // COMMENTS
  // =========================================================

  const addComment = (
    key
  ) => {

    const message =
      (
        drafts[key] || ""
      ).trim();

    if (!message) {
      return;
    }


    setComments(
      (previous) => ({
        ...previous,

        [key]: [
          ...(
            previous[key] || []
          ),

          {
            id:
              `${key}-${Date.now()}`,

            text: message,
          },
        ],
      })
    );


    setDrafts(
      (previous) => ({
        ...previous,
        [key]: "",
      })
    );
  };


  // =========================================================
  // SHARE COMPLAINT
  // =========================================================

  const shareComplaint =
    async (
      complaint
    ) => {

      const url =
        `${window.location.origin}/social?complaint=${encodeURIComponent(
          complaint.id
        )}`;


      try {

        if (
          navigator.share
        ) {

          await navigator.share({
            title:
              `Jan Drishti complaint #${complaint.id}`,
            url,
          });

        } else if (
          navigator.clipboard
        ) {

          await navigator.clipboard.writeText(
            url
          );

          alert(
            "Complaint link copied"
          );

        } else {

          window.prompt(
            "Copy complaint link",
            url
          );
        }

      } catch (err) {

        if (
          err.name !==
          "AbortError"
        ) {
          console.error(err);
        }
      }
    };


  // =========================================================
  // SHARE COMMUNITY POST
  // =========================================================

  const shareCommunityPost =
    async (
      post
    ) => {

      const url =
        `${window.location.origin}/social#community-post-${post.id}`;


      try {

        if (
          navigator.share
        ) {

          await navigator.share({
            title:
              `Post by @${post.username || "citizen"}`,
            text: post.text,
            url,
          });

        } else if (
          navigator.clipboard
        ) {

          await navigator.clipboard.writeText(
            url
          );

          alert(
            "Post link copied"
          );

        } else {

          window.prompt(
            "Copy post link",
            url
          );
        }

      } catch (err) {

        if (
          err.name !==
          "AbortError"
        ) {
          console.error(err);
        }
      }
    };


  // =========================================================
  // REFRESH EVERYTHING
  // =========================================================

  const refreshFeed = () => {
    fetchComplaints();
    fetchSocialPosts();
  };


  // =========================================================
  // UI
  // =========================================================

  return (

    <div className="jd-social">

      {/* ===================================================
          MOBILE HEADER
      =================================================== */}

      <header className="jd-mobile-top">

        <a
          href="/"
          className="jd-brand"
        >

          <span className="jd-mark">
            ज
          </span>

          <span>
            jan
            <span className="jd-brand-blue">
              drishti
            </span>

            <small>
              THE CIVIC NETWORK
            </small>
          </span>

        </a>


        <div className="jd-mobile-auth">

          {!auth.loading &&
            !auth.user && (

            <a
              href={LOGIN_PATH}
              className="jd-login-link"
            >
              Login
            </a>

          )}


          <a
            className="jd-mobile-report"
            href={reportUrl}
          >
            <Icon
              name="plus"
              size={17}
            />

            Report
          </a>

        </div>

      </header>


      <div className="jd-shell">

        {/* =================================================
            LEFT SIDEBAR
        ================================================= */}

        <aside className="jd-left">

          <a
            href="/"
            className="jd-brand"
          >

            <span className="jd-mark">
              ज
            </span>

            <span>
              jan
              <span className="jd-brand-blue">
                drishti
              </span>

              <small>
                THE CIVIC NETWORK
              </small>
            </span>

          </a>


          <div className="jd-nav-label">
            PLATFORM
          </div>


          <nav className="jd-nav">

            <a href="/">
              <Icon name="home" />
              Home
            </a>

            <a
              className="selected"
              href="/social"
            >
              <Icon name="message" />
              Civic feed
            </a>

            <a href="/civic-map">
              <Icon name="map" />
              Pressure map
            </a>

            <a href="/civic-map">
              <Icon name="chart" />
              Civic insights
            </a>

          </nav>


          <div className="jd-nav-label">
            TAKE ACTION
          </div>


          <a
            href={reportUrl}
            className="jd-report-button"
          >
            <Icon
              name="plus"
              size={20}
            />

            Report an issue
          </a>


          <div className="jd-auth-panel">

            {auth.loading ? (

              <span>
                Checking account...
              </span>

            ) : auth.user ? (

              <>
                <span className="jd-auth-label">
                  SIGNED IN
                </span>

                <strong>
                  {auth.user.username
                    ? `@${auth.user.username}`
                    : auth.user.name ||
                      "Citizen"}
                </strong>

                <a href="/my-complaints">
                  My complaints
                </a>
              </>

            ) : (

              <>
                <strong>
                  Join your community
                </strong>

                <p>
                  Explore the civic network.
                  Sign in to report issues
                  and create community posts.
                </p>

                <div className="jd-auth-actions">

                  <a href={LOGIN_PATH}>
                    Login
                  </a>

                  <a href={REGISTER_PATH}>
                    Register
                  </a>

                </div>
              </>

            )}

          </div>


          <div className="jd-side-note">

            <Icon
              name="shield"
              size={22}
            />

            <strong>
              Every voice matters.
            </strong>

            <p>
              Making civic issues visible,
              accountable and easier to
              resolve.
            </p>

          </div>


          <div className="jd-left-footer">
            © {new Date().getFullYear()}
            {" "}
            Jan Drishti
            <br />
            Built for better communities.
          </div>

        </aside>


        {/* =================================================
            CENTER FEED
        ================================================= */}

        <main className="jd-center">

          {/* HEADER */}

          <div className="jd-feed-top">

            <div>

              <h1>
                Civic feed
              </h1>

              <p>
                Your local public square
              </p>

            </div>


            <div className="jd-top-actions">

              {!auth.loading &&
                !auth.user && (

                <>
                  <a
                    className="jd-top-login"
                    href={LOGIN_PATH}
                  >
                    Login
                  </a>

                  <a
                    className="jd-top-register"
                    href={REGISTER_PATH}
                  >
                    Register
                  </a>
                </>

              )}


              {auth.user && (

                <a
                  className="jd-top-register"
                  href={REPORT_PATH}
                >
                  + Report issue
                </a>

              )}


              <button
                className="jd-icon-button"
                onClick={refreshFeed}
                title="Refresh feed"
                aria-label="Refresh feed"
              >
                <Icon name="refresh" />
              </button>

            </div>

          </div>


          {/* =================================================
              TABS
          ================================================= */}

          <div className="jd-feed-tabs">

            {[
              [
                "All",
                "For you",
              ],

              [
                "civic",
                "Civic issues",
              ],

              [
                "community",
                "Community",
              ],
            ].map(
              ([
                value,
                label,
              ]) => (

                <button
                  key={value}
                  className={
                    tab === value
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setTab(value)
                  }
                >
                  {label}


                </button>

              )
            )}

          </div>


          {/* =================================================
              CREATE COMMUNITY POST
          ================================================= */}

          <div className="jd-post jd-composer">

            <div className="jd-post-inner jd-composer-inner">

              <div className="jd-post-avatar jd-composer-avatar">
                {auth.user
                  ? String(
                      auth.user.username ||
                      auth.user.name ||
                      "C"
                    )
                      .charAt(0)
                      .toUpperCase()
                  : "C"}
              </div>


              <div className="jd-post-main jd-composer-main">

                {auth.user ? (

                  <>

                    <div className="jd-composer-user">
                      <strong>
                        {auth.user.username
                          ? `@${auth.user.username}`
                          : auth.user.name}
                      </strong>

                      <span className="jd-handle jd-composer-context">
                        Share with your community
                      </span>
                    </div>


                    <textarea
                      className="jd-composer-textarea"
                      value={postText}
                      onChange={(event) =>
                        setPostText(
                          event.target.value
                        )
                      }
                      maxLength={2000}
                      placeholder="What's happening in your area?"
                    />


                    {(postImage ||
                      postVideo) && (

                      <div className="jd-composer-attachments">

                        {postImage && (

                          <div>
                            📷{" "}
                            {postImage.name}
                          </div>

                        )}


                        {postVideo && (

                          <div>
                            🎥{" "}
                            {postVideo.name}
                          </div>

                        )}

                      </div>

                    )}


                    {postError && (

                      <div
                        className="jd-message jd-error"
                        style={{
                          marginTop: 10,
                          padding: 10,
                        }}
                      >
                        {postError}
                      </div>

                    )}


                    {postMessage && (

                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 13,
                        }}
                      >
                        {postMessage}
                      </div>

                    )}


                    <div className="jd-composer-actions">

                      <label className="jd-composer-media">
                        <Icon
                          name="image"
                          size={18}
                        />

                        Photo

                        <input
                          ref={
                            imageInputRef
                          }
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(
                            event
                          ) =>
                            setPostImage(
                              event.target
                                .files?.[0] ||
                                null
                            )
                          }
                        />
                      </label>


                      <label className="jd-composer-media">
                        <Icon
                          name="video"
                          size={18}
                        />

                        Video

                        <input
                          ref={
                            videoInputRef
                          }
                          type="file"
                          accept="video/*"
                          hidden
                          onChange={(
                            event
                          ) =>
                            setPostVideo(
                              event.target
                                .files?.[0] ||
                                null
                            )
                          }
                        />
                      </label>


                      <span className="jd-composer-count">
                        {postText.length}
                        /2000
                      </span>


                      <button
                        type="button"
                        className="jd-top-register jd-composer-submit"
                        disabled={
                          posting ||
                          !postText.trim()
                        }
                        onClick={
                          createCommunityPost
                        }
                      >
                        {posting
                          ? "Posting..."
                          : "Post"}
                      </button>

                    </div>

                  </>

                ) : (

                  <div>

                    <strong>
                      Join the civic conversation
                    </strong>

                    <p
                      style={{
                        margin:
                          "7px 0 12px",
                      }}
                    >
                      Sign in to share updates,
                      photos and videos with
                      your community.
                    </p>

                    <a
                      href="/login?next=%2Fsocial"
                      className="jd-top-register"
                    >
                      Login to post
                    </a>

                  </div>

                )}

              </div>

            </div>

          </div>


          {/* =================================================
              SEARCH
          ================================================= */}

          <div className="jd-search-bar">

            <Icon name="search" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search Jan Drishti"
              aria-label="Search civic feed"
            />


            <button
              onClick={() =>
                setFiltersOpen(
                  (value) => !value
                )
              }
              className={
                filtersOpen
                  ? "on"
                  : ""
              }
            >
              <Icon
                name="filter"
                size={17}
              />

              Filters
            </button>

          </div>


          {/* FILTERS */}

          {filtersOpen && (

            <div className="jd-filters">

              <div className="jd-filter-grid">

                <Select
                  label="State"
                  value={state}
                  values={states}
                  allLabel="All states"
                  onChange={(value) => {
                    setState(value);
                    setDistrict("All");
                    setArea("All");
                    setCategory("All");
                  }}
                />


                <Select
                  label="District"
                  value={district}
                  values={districts}
                  allLabel="All districts"
                  onChange={(value) => {
                    setDistrict(value);
                    setArea("All");
                    setCategory("All");
                  }}
                />


                <Select
                  label="Area"
                  value={area}
                  values={areas}
                  allLabel="All areas"
                  onChange={(value) => {
                    setArea(value);
                    setCategory("All");
                  }}
                />


                <Select
                  label="Category"
                  value={category}
                  values={categories}
                  allLabel="All categories"
                  onChange={
                    setCategory
                  }
                />


                <label className="jd-select">

                  <span>
                    Sort by
                  </span>

                  <select
                    value={sort}
                    onChange={(
                      event
                    ) =>
                      setSort(
                        event.target.value
                      )
                    }
                  >
                    <option value="latest">
                      Latest
                    </option>

                    <option value="trending">
                      Trending
                    </option>

                    <option value="supported">
                      Most supported
                    </option>
                  </select>

                </label>


                <label className="jd-select">

                  <span>
                    Civic status
                  </span>

                  <select
                    value={
                      [
                        "attention",
                        "escalated",
                        "resolved",
                      ].includes(tab)
                        ? tab
                        : "All"
                    }
                    onChange={(event) =>
                      setTab(event.target.value)
                    }
                  >
                    <option value="All">
                      All civic issues
                    </option>

                    <option value="attention">
                      Needs attention
                    </option>

                    <option value="escalated">
                      Escalated
                    </option>

                    <option value="resolved">
                      Resolved
                    </option>
                  </select>

                </label>

              </div>


              <button
                className="jd-clear"
                onClick={clear}
              >
                Clear all filters
              </button>

            </div>

          )}


          {/* FEED COUNT */}

          <div className="jd-feed-count">

            <span>

              <span className="jd-live-dot" />

              {" "}

              {loading ||
              socialLoading
                ? "Loading civic feed..."
                : `${feed.length} public ${
                    feed.length === 1
                      ? "update"
                      : "updates"
                  }`}

            </span>


            <span>
              Live civic timeline
            </span>

          </div>


          {/* ERRORS */}

          {error && (

            <div className="jd-message jd-error">

              <strong>
                Complaint feed unavailable
              </strong>

              <p>
                {error}
              </p>

              <button
                onClick={
                  fetchComplaints
                }
              >
                Try again
              </button>

            </div>

          )}


          {socialError && (

            <div className="jd-message jd-error">

              <strong>
                Community posts unavailable
              </strong>

              <p>
                {socialError}
              </p>

              <button
                onClick={
                  fetchSocialPosts
                }
              >
                Try again
              </button>

            </div>

          )}


          {(
            loading ||
            socialLoading
          ) &&
            !error &&
            !socialError && (

            <div className="jd-message">
              Loading civic feed...
            </div>

          )}


          {!loading &&
            !socialLoading &&
            !error &&
            !socialError &&
            feed.length === 0 && (

            <div className="jd-message">

              <Icon
                name="search"
                size={30}
              />

              <h3>
                No updates found
              </h3>

              <p>
                Try another tab,
                search or location.
              </p>

              <button
                onClick={clear}
              >
                Clear filters
              </button>

            </div>

          )}


          {/* =================================================
              MIXED FEED
          ================================================= */}

          {!loading &&
            !socialLoading &&
            feed.map((item) => {

              // ===============================================
              // COMMUNITY POST
              // ===============================================

              if (
                item.type ===
                "community"
              ) {

                const post =
                  item.data;

                const id =
                  post.id;

                const key =
                  `community-${id}`;

                const photo =
                  asset(
                    post.image_url
                  );

                const video =
                  asset(
                    post.video_url
                  );

                const displayName =
                  post.username
                    ? `@${post.username}`
                    : post.name ||
                      "Citizen";

                const avatar =
                  String(
                    post.username ||
                    post.name ||
                    "C"
                  )
                    .charAt(0)
                    .toUpperCase();


                return (

                  <article
                    className="jd-post"
                    key={key}
                    id={`community-post-${id}`}
                  >

                    <div className="jd-post-inner">

                      <div
                        className="jd-post-avatar"
                        style={{
                          fontWeight: 700,
                          fontSize: 16,
                        }}
                      >
                        {avatar}
                      </div>


                      <div className="jd-post-main">

                        <div className="jd-post-heading">

                          <div className="jd-author-line">

                            <strong>
                              {post.name ||
                                displayName}
                            </strong>

                            <span className="jd-handle">
                              {post.username
                                ? `@${post.username}`
                                : ""}
                              {" · "}
                              {when(
                                post.created_at
                              )}
                            </span>

                          </div>


                          <span
                            className="jd-status"
                            style={{
                              background:
                                "#f2f6ff",
                              color:
                                "#2463eb",
                            }}
                          >
                            Community
                          </span>

                        </div>


                        <div className="jd-post-body">

                          <p className="jd-community-text">
                            {post.text}
                          </p>

                        </div>


                        {photo && (

                          <div className="jd-post-media">

                            <img
                              src={photo}
                              alt={`Post by ${displayName}`}
                              loading="lazy"
                            />

                            <span>
                              <Icon
                                name="image"
                                size={13}
                              />

                              Community photo
                            </span>

                          </div>

                        )}


                        {video && (

                          <div className="jd-video-wrap">

                            {videoOpen[
                              key
                            ] ? (

                              <video
                                controls
                                playsInline
                                preload="metadata"
                                src={video}
                              />

                            ) : (

                              <button
                                onClick={() =>
                                  setVideoOpen(
                                    (
                                      previous
                                    ) => ({
                                      ...previous,

                                      [key]:
                                        true,
                                    })
                                  )
                                }
                              >
                                <Icon
                                  name="video"
                                  size={17}
                                />

                                View video
                              </button>

                            )}

                          </div>

                        )}


                        <div className="jd-post-actions">

                          <button
                            className={
                              commentOpen[
                                key
                              ]
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setCommentOpen(
                                (
                                  previous
                                ) => ({
                                  ...previous,

                                  [key]:
                                    !previous[
                                      key
                                    ],
                                })
                              )
                            }
                            aria-label="Comments"
                          >
                            <Icon
                              name="message"
                              size={18}
                            />

                            <span>
                              {comments[
                                key
                              ]?.length ||
                                0}
                            </span>
                          </button>


                          <button
                            className={
                              reposts[key]
                                ? "reposted"
                                : ""
                            }
                            onClick={() =>
                              setReposts(
                                (
                                  previous
                                ) => ({
                                  ...previous,

                                  [key]:
                                    previous[
                                      key
                                    ]
                                      ? 0
                                      : 1,
                                })
                              )
                            }
                            aria-label="Repost"
                          >
                            <Icon
                              name="repeat"
                              size={18}
                            />

                            <span>
                              {reposts[
                                key
                              ] || 0}
                            </span>
                          </button>


                          <button
                            className={
                              likes[key]
                                ? "liked"
                                : ""
                            }
                            onClick={() =>
                              setLikes(
                                (
                                  previous
                                ) => ({
                                  ...previous,

                                  [key]:
                                    previous[
                                      key
                                    ]
                                      ? 0
                                      : 1,
                                })
                              )
                            }
                            aria-label="Like post"
                          >
                            <Icon
                              name="heart"
                              size={18}
                            />

                            <span>
                              {likes[
                                key
                              ] || 0}
                            </span>
                          </button>


                          <button
                            onClick={() =>
                              shareCommunityPost(
                                post
                              )
                            }
                            aria-label="Share post"
                          >
                            <Icon
                              name="share"
                              size={18}
                            />

                            <span>
                              Share
                            </span>
                          </button>

                        </div>


                        {commentOpen[
                          key
                        ] && (

                          <div className="jd-comments">

                            <div className="jd-comment-input">

                              <input
                                value={
                                  drafts[
                                    key
                                  ] || ""
                                }
                                onChange={(
                                  event
                                ) =>
                                  setDrafts(
                                    (
                                      previous
                                    ) => ({
                                      ...previous,

                                      [key]:
                                        event
                                          .target
                                          .value,
                                    })
                                  )
                                }
                                onKeyDown={(
                                  event
                                ) =>
                                  event.key ===
                                    "Enter" &&
                                  addComment(
                                    key
                                  )
                                }
                                placeholder="Add a community comment..."
                              />


                              <button
                                onClick={() =>
                                  addComment(
                                    key
                                  )
                                }
                                disabled={
                                  !drafts[
                                    key
                                  ]?.trim()
                                }
                              >
                                Post
                              </button>

                            </div>


                            {(
                              comments[
                                key
                              ] || []
                            ).map(
                              (
                                comment
                              ) => (

                                <div
                                  className="jd-comment"
                                  key={
                                    comment.id
                                  }
                                >

                                  <span className="jd-comment-avatar">
                                    C
                                  </span>

                                  <div>

                                    <strong>
                                      Citizen
                                      {" "}
                                      <small>
                                        · Local preview
                                      </small>
                                    </strong>

                                    <p>
                                      {comment.text}
                                    </p>

                                  </div>

                                </div>

                              )
                            )}


                            <small className="jd-preview-note">
                              Likes, comments and reposts are temporary until the interaction API is connected.
                            </small>

                          </div>

                        )}

                      </div>

                    </div>

                  </article>

                );
              }


              // ===============================================
              // EXISTING COMPLAINT POST
              // ===============================================

              const complaint =
                item.data;

              const [
                statusLabel,
                statusTone,
              ] =
                status(
                  complaint
                );

              const id =
                complaint.id ??
                complaint._id;

              const key =
                `complaint-${id}`;

              const photo =
                asset(
                  complaint.image_url
                );

              const video =
                asset(
                  complaint.video_url
                );


              return (

                <article
                  className="jd-post"
                  key={key}
                  id={`complaint-${id}`}
                >

                  <div className="jd-post-inner">

                    <div className="jd-post-avatar">
                      <Icon
                        name="shield"
                        size={21}
                      />
                    </div>


                    <div className="jd-post-main">

                      <div className="jd-post-heading">

                        <div className="jd-author-line">

                          <strong>
                            Jan Drishti Civic
                          </strong>

                          <span
                            className="jd-verified"
                            title="Verified civic feed"
                          >
                            <Icon
                              name="check"
                              size={11}
                            />
                          </span>

                          <span className="jd-handle">
                            @jandrishti
                            {" · "}
                            {when(
                              complaint.created_at ||
                              complaint.createdAt ||
                              complaint.submitted_at ||
                              complaint.date
                            )}
                          </span>

                        </div>


                        <span
                          className={`jd-status ${statusTone}`}
                        >
                          {statusLabel}
                        </span>

                      </div>


                      <div className="jd-post-location">

                        <Icon
                          name="pin"
                          size={14}
                        />

                        {location(
                          complaint
                        )}

                        {" "}

                        <span>
                          ·
                        </span>

                        {" "}

                        Complaint #{id}

                      </div>


                      <div className="jd-post-body">

                        <span className="jd-category">
                          {complaint.category ||
                            "Civic issue"}
                        </span>

                        <h2>
                          {complaint.title ||
                            complaint.ai_summary ||
                            "Community issue reported"}
                        </h2>


                        {complaint.description && (

                          <p>
                            {complaint.description}
                          </p>

                        )}


                        {complaint.ai_summary &&
                          complaint.title && (

                          <p className="jd-summary">

                            <strong>
                              Summary:
                            </strong>

                            {" "}

                            {complaint.ai_summary}

                          </p>

                        )}

                      </div>


                      {photo && (

                        <div className="jd-post-media">

                          <img
                            src={photo}
                            alt={`Evidence for ${
                              complaint.category ||
                              "civic complaint"
                            }`}
                            loading="lazy"
                          />

                          <span>
                            <Icon
                              name="image"
                              size={13}
                            />

                            Citizen-submitted evidence
                          </span>

                        </div>

                      )}


                      {video && (

                        <div className="jd-video-wrap">

                          {videoOpen[
                            key
                          ] ? (

                            <video
                              controls
                              playsInline
                              preload="metadata"
                              src={video}
                            />

                          ) : (

                            <button
                              onClick={() =>
                                setVideoOpen(
                                  (
                                    previous
                                  ) => ({
                                    ...previous,

                                    [key]:
                                      true,
                                  })
                                )
                              }
                            >
                              <Icon
                                name="video"
                                size={17}
                              />

                              View video evidence
                            </button>

                          )}

                        </div>

                      )}


                      <div className="jd-post-details">

                        <div>

                          <span>
                            RESPONSIBLE AUTHORITY
                          </span>

                          <strong>
                            {complaint.authority ||
                              complaint.department ||
                              "Pending assignment"}
                          </strong>

                        </div>


                        <div>

                          <span>
                            REPORTED STATUS
                          </span>

                          <strong>
                            {complaint.status ||
                              "Verified"}
                          </strong>

                        </div>

                      </div>


                      {isOverdue(
                        complaint
                      ) && (

                        <div className="jd-post-alert">

                          <Icon
                            name="alert"
                            size={17}
                          />

                          <span>
                            Response deadline crossed. This issue needs attention.
                          </span>

                        </div>

                      )}


                      {complaint.social_escalated ===
                        "Yes" && (

                        <div className="jd-escalation">

                          <Icon
                            name="repeat"
                            size={16}
                          />

                          Public escalation recorded

                        </div>

                      )}


                      {complaint.response_date && (

                        <div className="jd-authority-response">

                          <Icon
                            name="check"
                            size={16}
                          />

                          Authority response recorded
                          {" · "}
                          {when(
                            complaint.response_date
                          )}

                        </div>

                      )}


                      <div className="jd-post-actions">

                        <button
                          className={
                            commentOpen[
                              key
                            ]
                              ? "active"
                              : ""
                          }
                          onClick={() =>
                            setCommentOpen(
                              (
                                previous
                              ) => ({
                                ...previous,

                                [key]:
                                  !previous[
                                    key
                                  ],
                              })
                            )
                          }
                          aria-label="Comments"
                        >
                          <Icon
                            name="message"
                            size={18}
                          />

                          <span>
                            {comments[
                              key
                            ]?.length ||
                              0}
                          </span>
                        </button>


                        <button
                          className={
                            reposts[
                              key
                            ]
                              ? "reposted"
                              : ""
                          }
                          onClick={() =>
                            setReposts(
                              (
                                previous
                              ) => ({
                                ...previous,

                                [key]:
                                  previous[
                                    key
                                  ]
                                    ? 0
                                    : 1,
                              })
                            )
                          }
                          aria-label="Repost locally"
                        >
                          <Icon
                            name="repeat"
                            size={18}
                          />

                          <span>
                            {reposts[
                              key
                            ] || 0}
                          </span>
                        </button>


                        <button
                          className={
                            likes[
                              key
                            ]
                              ? "liked"
                              : ""
                          }
                          onClick={() =>
                            setLikes(
                              (
                                previous
                              ) => ({
                                ...previous,

                                [key]:
                                  previous[
                                    key
                                  ]
                                    ? 0
                                    : 1,
                              })
                            )
                          }
                          aria-label="Support issue"
                        >
                          <Icon
                            name="heart"
                            size={18}
                          />

                          <span>
                            {likes[
                              key
                            ] || 0}
                          </span>
                        </button>


                        <button
                          onClick={() =>
                            shareComplaint(
                              complaint
                            )
                          }
                          aria-label="Share complaint"
                        >
                          <Icon
                            name="share"
                            size={18}
                          />

                          <span>
                            Share
                          </span>
                        </button>

                      </div>


                      {commentOpen[
                        key
                      ] && (

                        <div className="jd-comments">

                          <div className="jd-comment-input">

                            <input
                              value={
                                drafts[
                                  key
                                ] || ""
                              }
                              onChange={(
                                event
                              ) =>
                                setDrafts(
                                  (
                                    previous
                                  ) => ({
                                    ...previous,

                                    [key]:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              onKeyDown={(
                                event
                              ) =>
                                event.key ===
                                  "Enter" &&
                                addComment(
                                  key
                                )
                              }
                              placeholder="Add a community comment..."
                              aria-label="Write comment"
                            />

                            <button
                              onClick={() =>
                                addComment(
                                  key
                                )
                              }
                              disabled={
                                !drafts[
                                  key
                                ]?.trim()
                              }
                            >
                              Post
                            </button>

                          </div>


                          {(
                            comments[
                              key
                            ] || []
                          ).map(
                            (
                              comment
                            ) => (

                              <div
                                className="jd-comment"
                                key={
                                  comment.id
                                }
                              >

                                <span className="jd-comment-avatar">
                                  C
                                </span>

                                <div>

                                  <strong>
                                    Citizen
                                    {" "}
                                    <small>
                                      · Local preview
                                    </small>
                                  </strong>

                                  <p>
                                    {comment.text}
                                  </p>

                                </div>

                              </div>

                            )
                          )}


                          <small className="jd-preview-note">
                            Comments, likes and reposts are temporary on this device until a social interaction API is connected.
                          </small>

                        </div>

                      )}

                    </div>

                  </div>

                </article>

              );

            })}

        </main>


        {/* =================================================
            RIGHT SIDEBAR
        ================================================= */}

        <aside className="jd-right">

          <div className="jd-right-sticky">

            <div className="jd-right-header">

              <span className="jd-live-dot" />

              COMMUNITY PULSE

            </div>


            <section className="jd-right-card jd-pulse">

              <div className="jd-card-head">

                <h3>
                  Civic overview
                </h3>

                <span>
                  PUBLIC DATA
                </span>

              </div>


              <div className="jd-big-stat">

                {stats.total}

                <span>
                  verified reports
                </span>

              </div>


              <div className="jd-stat-grid">

                <div>

                  <span>
                    Needs attention
                  </span>

                  <strong className="amber">
                    {stats.attention}
                  </strong>

                </div>


                <div>

                  <span>
                    Escalated
                  </span>

                  <strong>
                    {stats.escalated}
                  </strong>

                </div>


                <div>

                  <span>
                    Resolved
                  </span>

                  <strong className="green">
                    {stats.resolved}
                  </strong>

                </div>


                <div>

                  <span>
                    Resolution rate
                  </span>

                  <strong>
                    {stats.total
                      ? Math.round(
                          (
                            stats.resolved /
                            stats.total
                          ) *
                            100
                        )
                      : 0}
                    %
                  </strong>

                </div>

              </div>

            </section>


            <section className="jd-right-card">

              <div className="jd-card-head">

                <h3>
                  Trending locations
                </h3>

                <Icon
                  name="map"
                  size={18}
                />

              </div>


              {Object.entries(

                publicItems.reduce(
                  (
                    accumulator,
                    complaint
                  ) => {

                    const key =
                      complaint.district ||
                      complaint.state ||
                      "Unspecified";

                    accumulator[key] =
                      (
                        accumulator[
                          key
                        ] || 0
                      ) + 1;

                    return accumulator;
                  },
                  {}
                )

              )
                .sort(
                  (a, b) =>
                    b[1] -
                    a[1]
                )
                .slice(0, 4)
                .map(
                  ([
                    name,
                    count,
                  ], index) => (

                    <button
                      className="jd-trend"
                      key={name}
                      onClick={() => {

                        if (
                          districts.includes(
                            name
                          )
                        ) {
                          setDistrict(
                            name
                          );

                          setArea(
                            "All"
                          );
                        } else if (
                          states.includes(
                            name
                          )
                        ) {
                          setState(
                            name
                          );

                          setDistrict(
                            "All"
                          );

                          setArea(
                            "All"
                          );
                        }

                        setTab(
                          "All"
                        );

                        window.scrollTo({
                          top: 0,
                          behavior:
                            "smooth",
                        });
                      }}
                    >

                      <span className="jd-trend-index">
                        0
                        {index + 1}
                      </span>


                      <span>

                        <strong>
                          {name}
                        </strong>

                        <small>
                          {count}
                          {" "}
                          public
                          {" "}
                          {count === 1
                            ? "issue"
                            : "issues"}
                        </small>

                      </span>


                      <Icon
                        name="arrow"
                        size={16}
                      />

                    </button>

                  )
                )}


              {!publicItems.length && (

                <p className="jd-empty-side">
                  Locations appear as reports are verified.
                </p>

              )}

            </section>


            <section className="jd-right-card jd-cta">

              <span className="jd-overline">
                MAKE AN IMPACT
              </span>

              <h3>
                See a problem in your area?
              </h3>

              <p>
                Bring it into the public eye
                and help your community get
                heard.
              </p>

              <a href={reportUrl}>
                Report an issue
                {" "}
                <Icon
                  name="arrow"
                  size={17}
                />
              </a>

            </section>


            <div className="jd-right-footer">
              Jan Drishti · Civic transparency platform
              <br />
              Public reports are subject to verification.
            </div>

          </div>

        </aside>

      </div>


      {/* ===================================================
          MOBILE BOTTOM NAV
      =================================================== */}

      <nav className="jd-bottom-nav">

        <a href="/">
          <Icon name="home" />
          Home
        </a>

        <a
          className="active"
          href="/social"
        >
          <Icon name="message" />
          Feed
        </a>

        <a href="/civic-map">
          <Icon name="map" />
          Map
        </a>

        <a href={reportUrl}>
          <Icon name="plus" />
          Report
        </a>

      </nav>

    </div>
  );
}
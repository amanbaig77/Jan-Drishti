import React, { useEffect, useMemo, useState } from "react";
import "./AdminPanel.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const complaintStatuses = [
  "Pending Review",
  "Verified",
  "Official Notified",
  "Rejected",
];

const contractStatuses = [
  "Submitted",
  "Under Review",
  "Technical Assessment",
  "Proposal",
  "Approved",
  "Rejected",
];

function AdminPanel() {
  const [activeTab, setActiveTab] = useState("overview");

  const [complaints, setComplaints] = useState([]);
  const [contracts, setContracts] = useState([]);

  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [loadingContracts, setLoadingContracts] = useState(true);

  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [complaintConsent, setComplaintConsent] = useState(null);
  const [complaintConsentLoading, setComplaintConsentLoading] = useState(false);

  const [complaintAction, setComplaintAction] = useState("");
  const [adminReviewKey, setAdminReviewKey] = useState(() => sessionStorage.getItem("jd_admin_review_key") || "");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [xEscalationEnabled, setXEscalationEnabled] = useState(false);
  const [contractAction, setContractAction] = useState("");

  const [contractForm, setContractForm] = useState({
    estimated_cost: "",
    proposed_timeline: "",
    warranty_period: "",
    admin_notes: "",
  });

  const [searchComplaint, setSearchComplaint] = useState("");
  const [searchContract, setSearchContract] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchComplaints();
    fetchContracts();
  }, []);

  useEffect(() => {
    setXEscalationEnabled(
      Boolean(selectedComplaint?.x_escalation_enabled)
    );
  }, [selectedComplaint?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadComplaintConsent = async () => {
      if (!selectedComplaint?.id) {
        setComplaintConsent(null);
        return;
      }

      try {
        setComplaintConsentLoading(true);

        const response = await fetch(
          `${API_BASE}/complaints/${selectedComplaint.id}/consent`
        );

        if (!response.ok) {
          throw new Error("Unable to load complaint authorization.");
        }

        const data = await response.json();

        if (!cancelled) {
          setComplaintConsent(Boolean(data.consent_given));
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setComplaintConsent(false);
        }
      } finally {
        if (!cancelled) {
          setComplaintConsentLoading(false);
        }
      }
    };

    loadComplaintConsent();

    return () => {
      cancelled = true;
    };
  }, [selectedComplaint?.id]);

  const fetchComplaints = async () => {
    try {
      setLoadingComplaints(true);

      const response = await fetch(`${API_BASE}/complaints/`);

      if (!response.ok) {
        throw new Error("Failed to load complaints");
      }

      const data = await response.json();
      setComplaints(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError("Unable to load complaints.");
    } finally {
      setLoadingComplaints(false);
    }
  };

  const fetchContracts = async () => {
    try {
      setLoadingContracts(true);

      const response = await fetch(`${API_BASE}/contracts/`);

      if (!response.ok) {
        throw new Error("Failed to load contracts");
      }

      const data = await response.json();
      setContracts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError("Unable to load contract requests.");
    } finally {
      setLoadingContracts(false);
    }
  };

  const showMessage = (text) => {
    setMessage(text);

    setTimeout(() => {
      setMessage("");
    }, 3500);
  };

  const handleComplaintReview = async () => {
    if (!selectedComplaint || !complaintAction) {
      return;
    }

    if (!adminReviewKey.trim()) {
      setError("Enter the admin review key to approve or reject complaints.");
      return;
    }

    try {
      setReviewBusy(true);
      setError("");

      sessionStorage.setItem(
        "jd_admin_review_key",
        adminReviewKey.trim()
      );

      const response = await fetch(
        `${API_BASE}/complaints/${selectedComplaint.id}/review`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Key": adminReviewKey.trim(),
          },
          body: JSON.stringify({
            action: complaintAction,
            x_escalation_enabled:
              complaintAction === "verify"
                ? xEscalationEnabled
                : false,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Complaint review failed");
      }

      const updatedComplaint = await response.json();

      await fetchComplaints();

      setSelectedComplaint(null);
      setComplaintAction("");

      const publication = updatedComplaint.x_publication;

      if (publication?.status === "published") {
        showMessage(
          `Complaint #${updatedComplaint.id} verified and published on X.`
        );

        window.open(
          publication.post_url,
          "_blank",
          "noopener,noreferrer"
        );
      } else if (publication?.status === "failed") {
        setError(
          `Complaint #${updatedComplaint.id} verified and authority notified, but X posting failed. Check backend logs and X API access.`
        );
      } else {
        showMessage(
          `Complaint #${updatedComplaint.id} reviewed successfully.`
        );
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to update complaint.");
    } finally {
      setReviewBusy(false);
    }
  };

  const handleContractReview = async () => {
    if (!selectedContract || !contractAction) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/contracts/${selectedContract.id}/review`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: contractAction,
            estimated_cost: contractForm.estimated_cost || null,
            proposed_timeline: contractForm.proposed_timeline || null,
            warranty_period: contractForm.warranty_period || null,
            admin_notes: contractForm.admin_notes || null,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Contract review failed");
      }

      const updatedContract = await response.json();

      setContracts((prev) =>
        prev.map((item) =>
          item.id === updatedContract.id ? updatedContract : item
        )
      );

      setSelectedContract(null);
      setContractAction("");

      setContractForm({
        estimated_cost: "",
        proposed_timeline: "",
        warranty_period: "",
        admin_notes: "",
      });

      showMessage(
        `Contract request #${updatedContract.id} updated successfully.`
      );
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to update contract.");
    }
  };

  const openContract = (contract) => {
    setSelectedContract(contract);
    setContractAction(contract.status || "Under Review");

    setContractForm({
      estimated_cost: contract.estimated_cost || "",
      proposed_timeline: contract.proposed_timeline || "",
      warranty_period: contract.warranty_period || "",
      admin_notes: contract.admin_notes || "",
    });
  };

  const filteredComplaints = useMemo(() => {
    const value = searchComplaint.trim().toLowerCase();

    if (!value) return complaints;

    return complaints.filter((item) =>
      [
        item.id,
        item.district,
        item.area,
        item.category,
        item.description,
        item.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [complaints, searchComplaint]);

  const filteredContracts = useMemo(() => {
    const value = searchContract.trim().toLowerCase();

    if (!value) return contracts;

    return contracts.filter((item) =>
      [
        item.id,
        item.requester_name,
        item.organization_name,
        item.district,
        item.area,
        item.work_category,
        item.work_title,
        item.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [contracts, searchContract]);

  const complaintStats = {
    total: complaints.length,
    pending: complaints.filter(
      (item) =>
        !item.status ||
        item.status === "Pending Review" ||
        item.status === "Submitted"
    ).length,
    verified: complaints.filter((item) => item.status === "Verified").length,
    notified: complaints.filter(
      (item) => item.status === "Official Notified"
    ).length,
    rejected: complaints.filter((item) => item.status === "Rejected").length,
  };

  const contractStats = {
    total: contracts.length,
    submitted: contracts.filter((item) => item.status === "Submitted").length,
    review: contracts.filter((item) => item.status === "Under Review").length,
    technical: contracts.filter(
      (item) => item.status === "Technical Assessment"
    ).length,
    proposal: contracts.filter((item) => item.status === "Proposal").length,
    approved: contracts.filter((item) => item.status === "Approved").length,
    rejected: contracts.filter((item) => item.status === "Rejected").length,
  };

  const formatDate = (date) => {
    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "—";
    }

    return parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusClass = (status) => {
    if (!status) return "status-neutral";

    const normalized = status.toLowerCase();

    if (
      normalized.includes("approved") ||
      normalized.includes("verified") ||
      normalized.includes("notified")
    ) {
      return "status-success";
    }

    if (
      normalized.includes("pending") ||
      normalized.includes("submitted") ||
      normalized.includes("review") ||
      normalized.includes("technical") ||
      normalized.includes("proposal")
    ) {
      return "status-warning";
    }

    if (normalized.includes("rejected")) {
      return "status-danger";
    }

    return "status-neutral";
  };

  const getSeverityClass = (severity) => {
    if (!severity) return "severity-neutral";

    const normalized = severity.toLowerCase();

    if (normalized.includes("high") || normalized.includes("critical")) {
      return "severity-high";
    }

    if (normalized.includes("medium")) {
      return "severity-medium";
    }

    if (normalized.includes("low")) {
      return "severity-low";
    }

    return "severity-neutral";
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-brand">
          <div className="admin-logo">JD</div>

          <div>
            <h1>Jan-Drishti</h1>
            <p>Administration Console</p>
          </div>
        </div>

        <div className="system-status">
          <span className="system-dot"></span>
          System Online
        </div>
      </header>

      <main className="admin-container">
        {message && <div className="admin-alert success">{message}</div>}

        {error && (
          <div className="admin-alert error">
            <span>{error}</span>

            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        <section className="admin-intro">
          <div>
            <span className="eyebrow">ADMINISTRATION</span>
            <h2>Jan-Drishti Operations</h2>
            <p>
              Review public complaints, manage civic work requests, and track
              operational progress from one place.
            </p>
          </div>
        </section>

        <nav className="admin-tabs">
          <button
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>

          <button
            className={activeTab === "complaints" ? "active" : ""}
            onClick={() => setActiveTab("complaints")}
          >
            Complaints
            <span>{complaints.length}</span>
          </button>

          <button
            className={activeTab === "contracts" ? "active" : ""}
            onClick={() => setActiveTab("contracts")}
          >
            Jan-Drishti Contract
            <span>{contracts.length}</span>
          </button>
        </nav>

        {activeTab === "overview" && (
          <div className="overview-content">
            <section className="section-block">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">PUBLIC COMPLAINTS</span>
                  <h3>Complaint Overview</h3>
                </div>

                <button
                  className="secondary-button"
                  onClick={fetchComplaints}
                >
                  Refresh
                </button>
              </div>

              <div className="stats-grid">
                <StatCard
                  title="Total Complaints"
                  value={complaintStats.total}
                  icon="C"
                  className="blue"
                />

                <StatCard
                  title="Pending Review"
                  value={complaintStats.pending}
                  icon="P"
                  className="orange"
                />

                <StatCard
                  title="Verified"
                  value={complaintStats.verified}
                  icon="V"
                  className="green"
                />

                <StatCard
                  title="Authority Notified"
                  value={complaintStats.notified}
                  icon="N"
                  className="purple"
                />

                <StatCard
                  title="Rejected"
                  value={complaintStats.rejected}
                  icon="R"
                  className="red"
                />
              </div>
            </section>

            <section className="section-block">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">CIVIC WORK</span>
                  <h3>Contract Overview</h3>
                </div>

                <button
                  className="secondary-button"
                  onClick={fetchContracts}
                >
                  Refresh
                </button>
              </div>

              <div className="stats-grid contract-stats">
                <StatCard
                  title="Submitted"
                  value={contractStats.submitted}
                  icon="S"
                  className="blue"
                />

                <StatCard
                  title="Under Review"
                  value={contractStats.review}
                  icon="R"
                  className="orange"
                />

                <StatCard
                  title="Technical Assessment"
                  value={contractStats.technical}
                  icon="T"
                  className="purple"
                />

                <StatCard
                  title="Proposal"
                  value={contractStats.proposal}
                  icon="P"
                  className="yellow"
                />

                <StatCard
                  title="Approved"
                  value={contractStats.approved}
                  icon="A"
                  className="green"
                />

                <StatCard
                  title="Rejected"
                  value={contractStats.rejected}
                  icon="X"
                  className="red"
                />
              </div>
            </section>

            <section className="overview-columns">
              <div className="panel-card">
                <div className="panel-card-header">
                  <div>
                    <span className="eyebrow">LATEST</span>
                    <h3>Recent Complaints</h3>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => setActiveTab("complaints")}
                  >
                    View all
                  </button>
                </div>

                {loadingComplaints ? (
                  <div className="empty-state">Loading complaints...</div>
                ) : complaints.length === 0 ? (
                  <div className="empty-state">
                    No complaints have been submitted yet.
                  </div>
                ) : (
                  <div className="mini-list">
                    {complaints.slice(0, 5).map((complaint) => (
                      <button
                        key={complaint.id}
                        className="mini-item"
                        onClick={() => setSelectedComplaint(complaint)}
                      >
                        <div className="mini-main">
                          <strong>
                            #{complaint.id} ·{" "}
                            {complaint.category || "Civic Issue"}
                          </strong>

                          <span>
                            {complaint.area || "Area not specified"},{" "}
                            {complaint.district || "District not specified"}
                          </span>
                        </div>

                        <span
                          className={`status-pill ${getStatusClass(
                            complaint.status
                          )}`}
                        >
                          {complaint.status || "Pending Review"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel-card">
                <div className="panel-card-header">
                  <div>
                    <span className="eyebrow">LATEST</span>
                    <h3>Contract Requests</h3>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => setActiveTab("contracts")}
                  >
                    View all
                  </button>
                </div>

                {loadingContracts ? (
                  <div className="empty-state">
                    Loading contract requests...
                  </div>
                ) : contracts.length === 0 ? (
                  <div className="empty-state">
                    No contract requests have been submitted yet.
                  </div>
                ) : (
                  <div className="mini-list">
                    {contracts.slice(0, 5).map((contract) => (
                      <button
                        key={contract.id}
                        className="mini-item"
                        onClick={() => openContract(contract)}
                      >
                        <div className="mini-main">
                          <strong>
                            #{contract.id} ·{" "}
                            {contract.work_title || "Civic Work Request"}
                          </strong>

                          <span>
                            {contract.area || "Area not specified"},{" "}
                            {contract.district || "District not specified"}
                          </span>
                        </div>

                        <span
                          className={`status-pill ${getStatusClass(
                            contract.status
                          )}`}
                        >
                          {contract.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === "complaints" && (
          <section className="data-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">PUBLIC REPORTING</span>
                <h3>Complaint Management</h3>
                <p>
                  Review submitted evidence and citizen-provided information
                  before verification.
                </p>
              </div>

              <button className="secondary-button" onClick={fetchComplaints}>
                Refresh
              </button>
            </div>

            <div className="toolbar">
              <div className="search-box">
                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search complaint, area, category..."
                  value={searchComplaint}
                  onChange={(e) => setSearchComplaint(e.target.value)}
                />
              </div>

              <div className="result-count">
                {filteredComplaints.length} result
                {filteredComplaints.length !== 1 ? "s" : ""}
              </div>
            </div>

            {loadingComplaints ? (
              <div className="large-empty">Loading complaints...</div>
            ) : filteredComplaints.length === 0 ? (
              <div className="large-empty">
                <div className="empty-icon">C</div>
                <h4>No complaints found</h4>
                <p>
                  Submitted complaints will appear here for administrative
                  review.
                </p>
              </div>
            ) : (
              <div className="complaint-list">
                {filteredComplaints.map((complaint) => (
                  <article className="complaint-card" key={complaint.id}>
                    <div className="complaint-card-top">
                      <div>
                        <div className="record-id">
                          Complaint #{complaint.id}
                        </div>

                        <h4>
                          {complaint.category || "Civic Issue"}
                        </h4>

                        <p className="location-text">
                          {complaint.area || "Area not specified"},{" "}
                          {complaint.district || "District not specified"}
                        </p>
                      </div>

                      <span
                        className={`status-pill ${getStatusClass(
                          complaint.status
                        )}`}
                      >
                        {complaint.status || "Pending Review"}
                      </span>
                    </div>

                    <div className="complaint-summary">
                      <p>
                        {complaint.ai_summary ||
                          complaint.description ||
                          "No description provided."}
                      </p>
                    </div>

                    <div className="complaint-meta-grid">
                      <MetaItem
                        label="Submitted"
                        value={formatDate(complaint.created_at)}
                      />

                      <MetaItem
                        label="Severity"
                        value={complaint.ai_severity || "Not assessed"}
                        valueClass={getSeverityClass(complaint.ai_severity)}
                      />

                      <MetaItem
                        label="Authority"
                        value={complaint.authority || "Not assigned"}
                      />

                      <MetaItem
                        label="Email"
                        value={complaint.authority_email || "Not assigned"}
                      />
                    </div>

                    <div className="card-actions">
                      <button
                        className="primary-button"
                        onClick={() => setSelectedComplaint(complaint)}
                      >
                        Review Complaint
                      </button>

                      {complaint.image_url && (
                        <a
                          href={`${API_BASE}/${complaint.image_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="secondary-button"
                        >
                          View Evidence
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "contracts" && (
          <section className="data-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">JAN-DRISHTI CONTRACT</span>
                <h3>Civic Work Requests</h3>
                <p>
                  Review work requests and move eligible projects through the
                  Jan-Drishti execution workflow.
                </p>
              </div>

              <button className="secondary-button" onClick={fetchContracts}>
                Refresh
              </button>
            </div>

            <div className="contract-workflow">
              {contractStatuses.map((status, index) => (
                <div className="workflow-step" key={status}>
                  <span>{index + 1}</span>
                  <strong>{status}</strong>
                </div>
              ))}
            </div>

            <div className="toolbar">
              <div className="search-box">
                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search requester, work, area..."
                  value={searchContract}
                  onChange={(e) => setSearchContract(e.target.value)}
                />
              </div>

              <div className="result-count">
                {filteredContracts.length} request
                {filteredContracts.length !== 1 ? "s" : ""}
              </div>
            </div>

            {loadingContracts ? (
              <div className="large-empty">
                Loading contract requests...
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="large-empty">
                <div className="empty-icon">W</div>
                <h4>No contract requests found</h4>
                <p>
                  New Jan-Drishti Contract requests will appear here.
                </p>
              </div>
            ) : (
              <div className="contract-list">
                {filteredContracts.map((contract) => (
                  <article className="contract-card" key={contract.id}>
                    <div className="contract-card-header">
                      <div>
                        <div className="record-id">
                          Contract Request #{contract.id}
                        </div>

                        <h4>
                          {contract.work_title || "Civic Work Request"}
                        </h4>

                        <p>
                          {contract.work_category || "Civic Work"} ·{" "}
                          {contract.area || "Area not specified"},{" "}
                          {contract.district || "District not specified"}
                        </p>
                      </div>

                      <span
                        className={`status-pill ${getStatusClass(
                          contract.status
                        )}`}
                      >
                        {contract.status}
                      </span>
                    </div>

                    <div className="contract-info-grid">
                      <MetaItem
                        label="Requester"
                        value={
                          contract.organization_name ||
                          contract.requester_name ||
                          "—"
                        }
                      />

                      <MetaItem
                        label="Requester Type"
                        value={contract.requester_type || "—"}
                      />

                      <MetaItem
                        label="Budget"
                        value={contract.approximate_budget || "Not specified"}
                      />

                      <MetaItem
                        label="Timeline"
                        value={contract.desired_timeline || "Not specified"}
                      />
                    </div>

                    <div className="contract-description">
                      <span>DESCRIPTION</span>

                      <p>
                        {contract.description ||
                          "No description provided."}
                      </p>
                    </div>

                    <div className="card-actions">
                      <button
                        className="primary-button"
                        onClick={() => openContract(contract)}
                      >
                        Review Request
                      </button>

                      {contract.image_url && (
                        <a
                          href={`${API_BASE}/${contract.image_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="secondary-button"
                        >
                          View Image
                        </a>
                      )}

                      {contract.document_url && (
                        <a
                          href={`${API_BASE}/${contract.document_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="secondary-button"
                        >
                          View Document
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {selectedComplaint && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedComplaint(null)}
        >
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">COMPLAINT REVIEW</span>

                <h3>
                  Complaint #{selectedComplaint.id}
                </h3>
              </div>

              <button
                className="modal-close"
                onClick={() => setSelectedComplaint(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-content">
              <div className="review-header">
                <div>
                  <strong>
                    {selectedComplaint.category || "Civic Issue"}
                  </strong>

                  <span>
                    {selectedComplaint.area || "Area not specified"},{" "}
                    {selectedComplaint.district ||
                      "District not specified"}
                  </span>
                </div>

                <span
                  className={`status-pill ${getStatusClass(
                    selectedComplaint.status
                  )}`}
                >
                  {selectedComplaint.status || "Pending Review"}
                </span>
              </div>

              <div className="review-section">
                <h4>Citizen Information</h4>

                <div className="detail-grid">
                  <DetailItem
                    label="Phone"
                    value={selectedComplaint.phone}
                  />

                  <DetailItem
                    label="Email"
                    value={selectedComplaint.email}
                  />

                  <DetailItem
                    label="Duration"
                    value={selectedComplaint.duration}
                  />

                  <DetailItem
                    label="Affected People"
                    value={selectedComplaint.affected_people}
                  />

                  <DetailItem
                    label="Affected Groups"
                    value={selectedComplaint.affected_groups}
                  />

                  <DetailItem
                    label="Traffic Impact"
                    value={selectedComplaint.traffic_impact}
                  />

                  <DetailItem
                    label="Immediate Danger"
                    value={selectedComplaint.immediate_danger}
                  />

                  <DetailItem
                    label="Exact Location"
                    value={selectedComplaint.exact_location}
                  />
                </div>
              </div>

              <div className="review-section">
                <h4>Complaint Description</h4>

                <div className="description-box">
                  {selectedComplaint.description ||
                    "No description provided."}
                </div>
              </div>

              <div
                className="review-section"
                style={{
                  padding: "20px",
                  borderRadius: "14px",
                  border: "1px solid #c7d2fe",
                  background: "#f8faff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <span className="eyebrow">NOTIFICATION ROUTING</span>
                    <h4 style={{ marginTop: "8px" }}>Where will this complaint go?</h4>
                  </div>

                  <span
                    style={{
                      padding: "8px 12px",
                      borderRadius: "999px",
                      fontWeight: 700,
                      fontSize: "12px",
                      background: complaintConsentLoading
                        ? "#f2f4f7"
                        : complaintConsent
                          ? "#ecfdf3"
                          : "#fff7ed",
                      color: complaintConsentLoading
                        ? "#667085"
                        : complaintConsent
                          ? "#067647"
                          : "#b54708",
                    }}
                  >
                    {complaintConsentLoading
                      ? "CHECKING"
                      : complaintConsent
                        ? "DIRECT AUTHORIZED"
                        : "ADMIN VERIFICATION"}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px",
                    marginTop: "16px",
                  }}
                >
                  <div
                    style={{
                      padding: "16px",
                      borderRadius: "12px",
                      background: "#ffffff",
                    }}
                  >
                    <span style={{ color: "#667085", fontSize: "12px", fontWeight: 700 }}>
                      GOING TO
                    </span>
                    <strong style={{ display: "block", marginTop: "7px" }}>
                      {selectedComplaint.authority || "Not assigned"}
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: "16px",
                      borderRadius: "12px",
                      background: "#ffffff",
                    }}
                  >
                    <span style={{ color: "#667085", fontSize: "12px", fontWeight: 700 }}>
                      NOTIFICATION EMAIL
                    </span>
                    <strong style={{ display: "block", marginTop: "7px", wordBreak: "break-word" }}>
                      {selectedComplaint.authority_email || "Not assigned"}
                    </strong>
                  </div>
                </div>

                <p style={{ margin: "14px 0 0", color: "#667085", lineHeight: 1.6 }}>
                  {complaintConsent
                    ? "The citizen explicitly agreed to share personal details with the concerned department, so the complaint is eligible for direct official notification."
                    : "The citizen did not authorize direct sharing. This complaint stays in Admin Review until an admin verifies it."}
                </p>
              </div>

              <div className="review-section">
                <h4>AI Assessment</h4>

                <div className="ai-review-box">
                  <div>
                    <span>Severity</span>

                    <strong
                      className={getSeverityClass(
                        selectedComplaint.ai_severity
                      )}
                    >
                      {selectedComplaint.ai_severity ||
                        "Not assessed"}
                    </strong>
                  </div>

                  <div>
                    <span>Public Impact</span>

                    <strong>
                      {selectedComplaint.ai_public_impact ||
                        "Not assessed"}
                    </strong>
                  </div>

                  <div>
                    <span>Authority</span>

                    <strong>
                      {selectedComplaint.authority ||
                        "Not assigned"}
                    </strong>
                  </div>
                </div>

                {selectedComplaint.ai_summary && (
                  <div className="description-box">
                    {selectedComplaint.ai_summary}
                  </div>
                )}

                {selectedComplaint.ai_official_report && (
                  <div className="official-report">
                    <span>OFFICIAL REPORT</span>

                    <p>
                      {selectedComplaint.ai_official_report}
                    </p>
                  </div>
                )}
              </div>

              {(selectedComplaint.image_url ||
                selectedComplaint.video_url) && (
                <div className="review-section">
                  <h4>Evidence</h4>

                  <div className="evidence-links">
                    {selectedComplaint.image_url && (
                      <a
                        href={`${API_BASE}/${selectedComplaint.image_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-button"
                      >
                        Open Image
                      </a>
                    )}

                    {selectedComplaint.video_url && (
                      <a
                        href={`${API_BASE}/${selectedComplaint.video_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-button"
                      >
                        Open Video
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* =======================================================
    X ESCALATION STATUS
======================================================= */}

<div
  className="review-section"
  style={{
    padding: "20px",
    borderRadius: "14px",
    border: "1px solid #d0d5dd",
    background: "#f9fafb",
  }}
>
  <span className="eyebrow">PUBLIC ESCALATION</span>

  <h4 style={{ marginTop: "8px" }}>
    X Escalation Status
  </h4>

  <div
    style={{
      display: "grid",
      gridTemplateColumns:
        "repeat(auto-fit, minmax(180px, 1fr))",
      gap: "12px",
      marginTop: "16px",
    }}
  >
    {/* X ESCALATION ENABLED */}

    <div
      style={{
        padding: "14px",
        borderRadius: "12px",
        background: "#ffffff",
      }}
    >
      <span
        style={{
          display: "block",
          color: "#667085",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        X ESCALATION
      </span>

      <strong
        style={{
          display: "block",
          marginTop: "6px",
        }}
      >
        {selectedComplaint.x_escalation_enabled
          ? "Enabled"
          : "Disabled"}
      </strong>
    </div>


    {/* RESPONSE DEADLINE */}

    <div
      style={{
        padding: "14px",
        borderRadius: "12px",
        background: "#ffffff",
      }}
    >
      <span
        style={{
          display: "block",
          color: "#667085",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        RESPONSE DEADLINE
      </span>

      <strong
        style={{
          display: "block",
          marginTop: "6px",
        }}
      >
        {selectedComplaint.response_deadline
          ? new Date(
              selectedComplaint.response_deadline
            ).toLocaleString("en-IN")
          : "Not set"}
      </strong>
    </div>


    {/* REMINDER */}

    <div
      style={{
        padding: "14px",
        borderRadius: "12px",
        background: "#ffffff",
      }}
    >
      <span
        style={{
          display: "block",
          color: "#667085",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        REMINDER
      </span>

      <strong
        style={{
          display: "block",
          marginTop: "6px",
        }}
      >
        {selectedComplaint.escalation_reminder_sent
          ? "Sent"
          : "Not Sent"}
      </strong>
    </div>


    {/* DEADLINE CROSSED */}

    <div
      style={{
        padding: "14px",
        borderRadius: "12px",
        background: "#ffffff",
      }}
    >
      <span
        style={{
          display: "block",
          color: "#667085",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        DEADLINE CROSSED
      </span>

      <strong
        style={{
          display: "block",
          marginTop: "6px",
        }}
      >
        {selectedComplaint.deadline_crossed || "No"}
      </strong>
    </div>


    {/* X POST STATUS */}

    <div
      style={{
        padding: "14px",
        borderRadius: "12px",
        background: "#ffffff",
      }}
    >
      <span
        style={{
          display: "block",
          color: "#667085",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        X STATUS
      </span>

      <strong
        style={{
          display: "block",
          marginTop: "6px",
        }}
      >
        {selectedComplaint.social_escalated === "Yes"
          ? "Posted"
          : selectedComplaint.x_escalation_enabled
            ? "Waiting"
            : "Not Enabled"}
      </strong>
    </div>


    {/* PLATFORM */}

    <div
      style={{
        padding: "14px",
        borderRadius: "12px",
        background: "#ffffff",
      }}
    >
      <span
        style={{
          display: "block",
          color: "#667085",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        PLATFORM
      </span>

      <strong
        style={{
          display: "block",
          marginTop: "6px",
        }}
      >
        {selectedComplaint.social_platform || "—"}
      </strong>
    </div>
  </div>


  {/* POSTED RESULT */}

  {selectedComplaint.social_escalated === "Yes" && (
    <div
      style={{
        marginTop: "16px",
        padding: "16px",
        borderRadius: "12px",
        background: "#ffffff",
      }}
    >
      <strong>
        Public escalation completed
      </strong>

      {selectedComplaint.social_escalated_at && (
        <p
          style={{
            margin: "6px 0 12px",
            color: "#667085",
          }}
        >
          Posted{" "}
          {new Date(
            selectedComplaint.social_escalated_at
          ).toLocaleString("en-IN")}
        </p>
      )}

      {selectedComplaint.social_post_url && (
        <a
          href={selectedComplaint.social_post_url}
          target="_blank"
          rel="noreferrer"
          className="primary-button"
          style={{
            display: "inline-block",
            textDecoration: "none",
          }}
        >
          View X Post
        </a>
      )}
    </div>
  )}
</div>



              <div className="review-action">
                <label htmlFor="jd-admin-secret">Admin review key</label>
                <input
                  id="jd-admin-secret"
                  type="password"
                  autoComplete="off"
                  value={adminReviewKey}
                  onChange={(e) => setAdminReviewKey(e.target.value)}
                  placeholder="Enter backend admin review key"
                  style={{ width: "100%", padding: "10px", marginBottom: "16px", border: "1px solid #ccd5e0", borderRadius: "8px" }}
                />
                <label>Administrative Action</label>

                <select
                  value={complaintAction}
                  onChange={(e) => setComplaintAction(e.target.value)}
                >
                  <option value="">Select action</option>

                  <option value="verify">Verify Complaint</option>

                  <option value="reject">Reject Complaint</option>
                </select>

                {complaintAction === "verify" && (
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      marginTop: "14px",
                      cursor: "pointer",
                      lineHeight: 1.5,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={xEscalationEnabled}
                      onChange={(e) =>
                        setXEscalationEnabled(e.target.checked)
                      }
                      style={{
                        marginTop: "3px",
                        width: "17px",
                        height: "17px",
                      }}
                    />

                    <span>
                      <strong>
                        Publish immediately on X after approval
                      </strong>
                      <br />
                      <small style={{ color: "#667085" }}>
                        Once you verify, Jan-Drishti will immediately publish a public summary to X. Do not select for private or unverified information.
                      </small>
                    </span>
                  </label>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                onClick={() => setSelectedComplaint(null)}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                disabled={!complaintAction || reviewBusy}
                onClick={handleComplaintReview}
              >
                {reviewBusy ? "Verifying and publishing..." : "Save Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedContract && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedContract(null)}
        >
          <div
            className="admin-modal contract-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">JAN-DRISHTI CONTRACT</span>

                <h3>
                  Request #{selectedContract.id}
                </h3>
              </div>

              <button
                className="modal-close"
                onClick={() => setSelectedContract(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-content">
              <div className="review-header">
                <div>
                  <strong>
                    {selectedContract.work_title ||
                      "Civic Work Request"}
                  </strong>

                  <span>
                    {selectedContract.work_category || "Civic Work"}
                  </span>
                </div>

                <span
                  className={`status-pill ${getStatusClass(
                    selectedContract.status
                  )}`}
                >
                  {selectedContract.status}
                </span>
              </div>

              <div className="review-section">
                <h4>Requester Details</h4>

                <div className="detail-grid">
                  <DetailItem
                    label="Requester"
                    value={selectedContract.requester_name}
                  />

                  <DetailItem
                    label="Type"
                    value={selectedContract.requester_type}
                  />

                  <DetailItem
                    label="Organization"
                    value={selectedContract.organization_name}
                  />

                  <DetailItem
                    label="Phone"
                    value={selectedContract.phone}
                  />

                  <DetailItem
                    label="Email"
                    value={selectedContract.email}
                  />

                  <DetailItem
                    label="Location"
                    value={`${selectedContract.area || ""}, ${
                      selectedContract.district || ""
                    }`}
                  />
                </div>
              </div>

              <div className="review-section">
                <h4>Work Request</h4>

                <div className="detail-grid">
                  <DetailItem
                    label="Work Category"
                    value={selectedContract.work_category}
                  />

                  <DetailItem
                    label="Approx. Budget"
                    value={selectedContract.approximate_budget}
                  />

                  <DetailItem
                    label="Desired Timeline"
                    value={selectedContract.desired_timeline}
                  />

                  <DetailItem
                    label="Exact Location"
                    value={selectedContract.exact_location}
                  />
                </div>

                <div className="description-box">
                  {selectedContract.description ||
                    "No description provided."}
                </div>

                {selectedContract.expected_scope && (
                  <div className="scope-box">
                    <span>EXPECTED SCOPE</span>

                    <p>{selectedContract.expected_scope}</p>
                  </div>
                )}
              </div>

              <div className="review-section">
                <h4>Administrative Review</h4>

                <div className="form-grid">
                  <div className="form-field">
                    <label>Workflow Status</label>

                    <select
                      value={contractAction}
                      onChange={(e) =>
                        setContractAction(e.target.value)
                      }
                    >
                      {contractStatuses
                        .filter((status) => status !== "Submitted")
                        .map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Estimated Cost</label>

                    <input
                      type="text"
                      placeholder="e.g. ₹1,80,000"
                      value={contractForm.estimated_cost}
                      onChange={(e) =>
                        setContractForm((prev) => ({
                          ...prev,
                          estimated_cost: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label>Proposed Timeline</label>

                    <input
                      type="text"
                      placeholder="e.g. 15 days"
                      value={contractForm.proposed_timeline}
                      onChange={(e) =>
                        setContractForm((prev) => ({
                          ...prev,
                          proposed_timeline: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label>Warranty Period</label>

                    <input
                      type="text"
                      placeholder="e.g. 2 years"
                      value={contractForm.warranty_period}
                      onChange={(e) =>
                        setContractForm((prev) => ({
                          ...prev,
                          warranty_period: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-field full">
                    <label>Admin Notes</label>

                    <textarea
                      rows="4"
                      placeholder="Add internal review notes..."
                      value={contractForm.admin_notes}
                      onChange={(e) =>
                        setContractForm((prev) => ({
                          ...prev,
                          admin_notes: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="workflow-note">
                <strong>Execution workflow</strong>

                <p>
                  Request → Review → Technical Assessment → Proposal →
                  Approval → Verified Execution Partner → Work Execution →
                  Inspection → Completion Report
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                onClick={() => setSelectedContract(null)}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                disabled={!contractAction}
                onClick={handleContractReview}
              >
                Save Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, className }) {
  return (
    <div className={`stat-card ${className || ""}`}>
      <div className="stat-icon">{icon}</div>

      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function MetaItem({ label, value, valueClass = "" }) {
  return (
    <div className="meta-item">
      <span>{label}</span>
      <strong className={valueClass}>{value || "—"}</strong>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value || "Not provided"}</strong>
    </div>
  );
}

export default AdminPanel;
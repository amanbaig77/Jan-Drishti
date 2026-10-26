import { useState } from "react";
import "./Register.css";

const API_URL = "http://127.0.0.1:8000";

function Register() {
  const [accountType, setAccountType] = useState("Citizen");
  const [helperType, setHelperType] = useState("");

  const [form, setForm] = useState({
    name: "",
    username: "",
    organization_name: "",
    email: "",
    phone: "",
    password: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const selectAccountType = (type) => {
    setAccountType(type);
    setError("");
    setSuccess(null);

    if (type === "Citizen") {
      setHelperType("");

      setForm((prev) => ({
        ...prev,
        organization_name: "",
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess(null);

    if (
      accountType === "Helping Community" &&
      !helperType
    ) {
      setError(
        "Please select NGO, Company / CSR, or Individual."
      );

      return;
    }

    if (
      accountType === "Helping Community" &&
      ["NGO", "Company / CSR"].includes(helperType) &&
      !form.organization_name.trim()
    ) {
      setError(
        "Please enter the organization name."
      );

      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        `${API_URL}/auth/register`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            name: form.name.trim(),

            username: form.username
              .trim()
              .toLowerCase(),

            email: form.email.trim(),

            phone: form.phone.trim(),

            password: form.password,

            account_type: accountType,

            helper_type:
              accountType === "Helping Community"
                ? helperType
                : null,

            organization_name:
              accountType === "Helping Community" &&
              ["NGO", "Company / CSR"].includes(
                helperType
              )
                ? form.organization_name.trim()
                : null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        let message =
          "Unable to create account.";

        if (
          typeof result.detail === "string"
        ) {
          message = result.detail;
        } else if (
          Array.isArray(result.detail)
        ) {
          message = result.detail
            .map((item) => item.msg)
            .filter(Boolean)
            .join(" ");
        }

        throw new Error(message);
      }

      const sessionProfile = {
        user_id: result.user_id,

        name: result.name,

        username: result.username,

        email: result.email,

        account_type: result.account_type,

        helper_type: result.helper_type,

        organization_name:
          result.organization_name,
      };

      localStorage.setItem(
        "jan_drishti_user",
        JSON.stringify(sessionProfile)
      );

      setSuccess(result);

      setForm({
        name: "",
        username: "",
        organization_name: "",
        email: "",
        phone: "",
        password: "",
      });

    } catch (err) {
      console.error(
        "Registration error:",
        err
      );

      setError(
        err.message ||
        "Unable to create account."
      );

    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="register-page">

      <header className="register-header">

        <a
          href="/"
          className="register-brand"
        >
          <div className="register-logo">
            JD
          </div>

          <div>
            <h1>Jan-Drishti</h1>

            <span>
              Civic Participation Network
            </span>
          </div>
        </a>

        <a
          href="/social"
          className="register-back-link"
        >
          Civic Social →
        </a>

      </header>


      <main className="register-main">

        <section className="register-intro">

          <span>
            JOIN JAN-DRISHTI
          </span>

          <h2>
            One platform.
            <br />

            <em>
              Two ways to participate.
            </em>
          </h2>

          <p>
            Citizens can report civic issues.
            Helping Community members can support
            verified problems through NGOs,
            companies, CSR teams or individual
            action.
          </p>

          <div className="register-flow">

            <div>
              <b>01</b>
              <span>Join</span>
            </div>

            <i></i>

            <div>
              <b>02</b>
              <span>Participate</span>
            </div>

            <i></i>

            <div>
              <b>03</b>
              <span>Create impact</span>
            </div>

          </div>

        </section>


        <section className="register-card">

          <div className="register-card-heading">

            <span>
              CREATE ACCOUNT
            </span>

            <h3>
              How will you use Jan-Drishti?
            </h3>

            <p>
              Choose one. You can start
              in less than a minute.
            </p>

          </div>


          <div className="account-type-grid">

            <button
              type="button"
              className={
                accountType === "Citizen"
                  ? "account-type-card active"
                  : "account-type-card"
              }
              onClick={() =>
                selectAccountType(
                  "Citizen"
                )
              }
            >

              <div className="account-type-icon">
                C
              </div>

              <div>
                <strong>
                  Citizen
                </strong>

                <span>
                  Report and follow civic issues
                </span>
              </div>

              <b>✓</b>

            </button>


            <button
              type="button"
              className={
                accountType ===
                "Helping Community"
                  ? "account-type-card active"
                  : "account-type-card"
              }
              onClick={() =>
                selectAccountType(
                  "Helping Community"
                )
              }
            >

              <div className="account-type-icon help">
                H
              </div>

              <div>
                <strong>
                  Helping Community
                </strong>

                <span>
                  Help resolve verified
                  civic problems
                </span>
              </div>

              <b>✓</b>

            </button>

          </div>


          {accountType ===
            "Helping Community" && (

            <div className="helper-type-section">

              <label>
                YOU ARE JOINING AS
              </label>

              <div className="helper-type-grid">

                {[
                  "NGO",
                  "Company / CSR",
                  "Individual",
                ].map((type) => (

                  <button
                    type="button"
                    key={type}
                    className={
                      helperType === type
                        ? "helper-type active"
                        : "helper-type"
                    }
                    onClick={() => {

                      setHelperType(type);

                      setError("");

                      if (
                        type === "Individual"
                      ) {
                        setForm(
                          (prev) => ({
                            ...prev,

                            organization_name:
                              "",
                          })
                        );
                      }
                    }}
                  >
                    {type}
                  </button>

                ))}

              </div>

            </div>

          )}


          {error && (

            <div className="register-message error">

              <strong>
                Unable to register
              </strong>

              <span>
                {error}
              </span>

            </div>

          )}


          {success && (

            <div className="register-message success">

              <strong>
                Account created successfully
              </strong>

              <span>
                Welcome to Jan-Drishti,
                {" "}
                @{success.username}.
              </span>

            </div>

          )}


          {!success ? (

            <form
              onSubmit={handleSubmit}
              className="register-form"
            >

              <div className="register-field full">

                <label>

                  {accountType ===
                    "Helping Community" &&
                  [
                    "NGO",
                    "Company / CSR",
                  ].includes(helperType)
                    ? "Representative Name"
                    : "Full Name"}

                  <span>*</span>

                </label>

                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter your name"
                  required
                />

              </div>


              <div className="register-field full">

                <label>
                  Username
                  <span>*</span>
                </label>

                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="e.g. aman_civic"
                  minLength={3}
                  maxLength={30}
                  autoCapitalize="none"
                  autoCorrect="off"
                  required
                />

                <small>
                  This will be your public
                  Jan-Drishti identity.
                </small>

              </div>


              {accountType ===
                "Helping Community" &&
                [
                  "NGO",
                  "Company / CSR",
                ].includes(helperType) && (

                <div className="register-field full">

                  <label>

                    {helperType === "NGO"
                      ? "NGO Name"
                      : "Company / Organization Name"}

                    <span>*</span>

                  </label>

                  <input
                    type="text"
                    name="organization_name"
                    value={
                      form.organization_name
                    }
                    onChange={handleChange}
                    placeholder={
                      helperType === "NGO"
                        ? "e.g. Seva Foundation"
                        : "e.g. ABC Industries"
                    }
                    required
                  />

                </div>

              )}


              <div className="register-field">

                <label>
                  Email
                  <span>*</span>
                </label>

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  required
                />

              </div>


              <div className="register-field">

                <label>
                  Phone
                  <span>*</span>
                </label>

                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="10-digit mobile number"
                  required
                />

              </div>


              <div className="register-field full">

                <label>
                  Password
                  <span>*</span>
                </label>

                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  required
                />

              </div>


              <div className="register-note">

                <strong>
                  Public identity
                </strong>

                <span>
                  Your username will represent
                  you publicly on Jan-Drishti.
                  Your email and phone remain
                  account information.
                </span>

              </div>


              <button
                type="submit"
                className="register-submit"
                disabled={submitting}
              >

                {submitting
                  ? "Creating account..."
                  : accountType ===
                    "Helping Community"
                    ? "Join Helping Community →"
                    : "Create Citizen Account →"}

              </button>

            </form>

          ) : (

            <div className="register-success-actions">

              {success.account_type ===
                "Helping Community" ? (

                <>

                  <div className="registered-helper-card">

                    <span>
                      HELPING COMMUNITY PROFILE
                    </span>

                    <strong>
                      {success.organization_name ||
                        success.name}
                    </strong>

                    <small>
                      @{success.username}
                      {" · "}
                      {success.helper_type}
                      {" · "}
                      Ready to participate
                    </small>

                  </div>

                  <a
                    href="/social"
                    className="register-primary-link"
                  >
                    Explore problems to help →
                  </a>

                </>

              ) : (

                <a
                  href="/"
                  className="register-primary-link"
                >
                  Go to Jan-Drishti →
                </a>

              )}


              <button
                type="button"
                className="register-secondary-button"
                onClick={() => {

                  setSuccess(null);

                  setAccountType(
                    "Citizen"
                  );

                  setHelperType("");

                }}
              >
                Register another account
              </button>

            </div>

          )}

        </section>

      </main>

    </div>
  );
}

export default Register;